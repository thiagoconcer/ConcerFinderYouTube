-- ---------------------------------------------------------------------------
-- Leads internos fora dos relatórios, e filtros na lista de leads.
--
-- O PROBLEMA. A equipe testa o produto o dia inteiro: Bruno e Bárbara buscaram
-- dezenas de vezes com dores inventadas para conferir a busca. Com 19 pessoas na
-- base, duas contas internas com muita atividade não são ruído, são a maior
-- parte do número: elas puxam a média de buscas por pessoa, aparecem no topo do
-- score (justamente porque voltam todo dia) e enchem o ranking de temas com
-- assunto que ninguém de fora pediu. O painel existe para ler audiência real.
--
-- QUEM É INTERNO. Duas regras somadas, para nenhuma das duas precisar de
-- manutenção: quem tem papel diferente de 'user' (staff) e quem tem e-mail
-- @thiagoconcer.com.br. A segunda pega quem ainda não recebeu papel interno, que
-- é exatamente o caso que gerou este pedido.
--
-- COLUNA E NÃO SÓ FUNÇÃO. `profiles.is_internal` é materializada por trigger
-- porque ela entra no WHERE de todos os relatórios: recalcular a regra por linha
-- em cada agregação custaria varredura extra a cada carga do painel. A função
-- `perfil_interno(uuid)` existe para as tabelas que só têm `profile_id`.
--
-- Nada é apagado. O dado interno continua no banco, e a ficha da pessoa continua
-- abrindo normalmente: o que muda é ele não entrar nas contas nem na lista.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists is_internal boolean not null default false;

comment on column public.profiles.is_internal is
  'Conta da equipe (papel interno ou e-mail @thiagoconcer.com.br). Fica fora dos relatórios e da lista de leads.';

create or replace function public.eh_conta_interna(p_email text, p_role text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_role, 'user') <> 'user'
      or lower(coalesce(p_email, '')) like '%@thiagoconcer.com.br'
$$;

create or replace function public.marca_conta_interna()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.is_internal := public.eh_conta_interna(new.email, new.role);
  return new;
end;
$$;

drop trigger if exists trg_marca_conta_interna on public.profiles;
create trigger trg_marca_conta_interna
  before insert or update of email, role on public.profiles
  for each row execute function public.marca_conta_interna();

-- Backfill: a regra vale para quem já estava na base.
update public.profiles
set is_internal = public.eh_conta_interna(email, role)
where is_internal is distinct from public.eh_conta_interna(email, role);

create index if not exists idx_profiles_is_internal
  on public.profiles (is_internal)
  where is_internal;

/*
  Para as tabelas que carregam só `profile_id` (leads, searches, video_views).
  STABLE e não IMMUTABLE porque lê tabela; SECURITY DEFINER porque é chamada de
  dentro de funções de relatório que já conferiram que quem pergunta é staff.
*/
create or replace function public.perfil_interno(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_internal from public.profiles p where p.id = p_profile_id),
    false
  )
$$;

-- ---------------------------------------------------------------------------
-- Os seis relatórios do painel passam a ignorar conta interna.
-- Corpos idênticos aos que estavam no ar, com o filtro somado a cada leitura de
-- `profiles` e `leads`. Reescritos por inteiro porque o Postgres não tem
-- "alterar o WHERE desta função".
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_audience_insights(from_date timestamp with time zone DEFAULT NULL::timestamp with time zone, to_date timestamp with time zone DEFAULT NULL::timestamp with time zone, filter_commercial_role text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  resultado jsonb;
  inicio timestamptz := coalesce(from_date, now() - interval '90 days');
  fim timestamptz := coalesce(to_date, now());
begin
  if not public.is_concer_staff() then
    raise exception 'Acesso restrito à equipe Concer.' using errcode = '42501';
  end if;

  with busca as (
    select s.id, s.detected_topics, s.created_at, p.commercial_role
    from public.searches s
    join public.profiles p on p.id = s.profile_id and not p.is_internal
    where s.created_at between inicio and fim
      and (filter_commercial_role is null or p.commercial_role = filter_commercial_role)
  ),
  tema as (
    select unnest(coalesce(b.detected_topics, array[]::text[])) as topico, b.commercial_role
    from busca b
  ),
  recomendado as (
    select r.segment_id, r.video_id, count(*) as vezes, avg(r.similarity_score) as score_medio
    from public.search_results r
    join busca b on b.id = r.search_id
    group by r.segment_id, r.video_id
  ),
  assistido as (
    select v.segment_id, v.video_id, count(*) as vezes
    from public.video_views v
    join public.profiles p on p.id = v.profile_id and not p.is_internal
    where v.created_at between inicio and fim
      and (filter_commercial_role is null or p.commercial_role = filter_commercial_role)
    group by v.segment_id, v.video_id
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('de', inicio, 'ate', fim),

    'totais', (
      select jsonb_build_object(
        'leads', (select count(*) from public.leads l
                   where not public.perfil_interno(l.profile_id)
                     and (filter_commercial_role is null or l.commercial_role = filter_commercial_role)),
        'perfis', (select count(*) from public.profiles pf
                    where not pf.is_internal
      and (filter_commercial_role is null or pf.commercial_role = filter_commercial_role)),
        'buscas', (select count(*) from busca),
        'visualizacoes', (select count(*) from public.video_views w
                           join public.profiles pv on pv.id = w.profile_id and not pv.is_internal
                           where w.created_at between inicio and fim
                             and (filter_commercial_role is null or pv.commercial_role = filter_commercial_role)),
        'videos_indexados', (select count(*) from public.videos where transcription_status = 'indexed')
      )
    ),

    'leads_por_perfil', coalesce((
      select jsonb_agg(x order by x->>'commercial_role')
      from (
        select jsonb_build_object('commercial_role', commercial_role, 'total', count(*)) as x
        from public.leads
        where not public.perfil_interno(profile_id)
          and (filter_commercial_role is null or commercial_role = filter_commercial_role)
        group by commercial_role
      ) t
    ), '[]'::jsonb),

    'nutricao', coalesce((
      select jsonb_object_agg(nurture_status, total)
      from (select nurture_status, count(*) as total from public.leads
            where not public.perfil_interno(profile_id)
              and (filter_commercial_role is null or commercial_role = filter_commercial_role)
            group by nurture_status) t
    ), '{}'::jsonb),

    'temas', coalesce((
      select jsonb_agg(x order by (x->>'total')::int desc)
      from (
        select jsonb_build_object('topico', topico, 'total', count(*)) as x
        from tema where topico is not null and topico <> ''
        group by topico order by count(*) desc limit 25
      ) t
    ), '[]'::jsonb),

    'temas_por_perfil', coalesce((
      select jsonb_agg(x)
      from (
        select jsonb_build_object(
          'topico', topico, 'commercial_role', commercial_role, 'total', count(*)
        ) as x
        from tema where topico is not null and topico <> ''
        group by topico, commercial_role
        order by count(*) desc limit 60
      ) t
    ), '[]'::jsonb),

    -- quem procura o quê: por perfil, os temas que ele mais busca
    'perfis_por_tema', coalesce((
      select jsonb_agg(x order by x->>'commercial_role')
      from (
        select jsonb_build_object(
          'commercial_role', commercial_role,
          'total', sum(total),
          'temas', jsonb_agg(jsonb_build_object('topico', topico, 'total', total) order by total desc)
        ) as x
        from (
          select commercial_role, topico, count(*) as total
          from tema where topico is not null and topico <> ''
          group by commercial_role, topico
        ) c
        group by commercial_role
      ) t
    ), '[]'::jsonb),

    -- o que a busca mais devolveu
    'trechos_mais_recomendados', coalesce((
      select jsonb_agg(x order by (x->>'vezes')::int desc)
      from (
        select jsonb_build_object(
          'segment_id', rec.segment_id,
          'video_id', rec.video_id,
          'youtube_video_id', v.youtube_video_id,
          'title', v.title,
          'start_seconds', seg.start_seconds,
          'trecho', left(seg.segment_text, 160),
          'vezes', rec.vezes,
          'score_medio', round(rec.score_medio::numeric, 3)
        ) as x
        from recomendado rec
        join public.videos v on v.id = rec.video_id
        join public.video_segments seg on seg.id = rec.segment_id
        order by rec.vezes desc, rec.score_medio desc limit 15
      ) t
    ), '[]'::jsonb),

    -- o que as pessoas realmente abriram
    'trechos_mais_assistidos', coalesce((
      select jsonb_agg(x order by (x->>'vezes')::int desc)
      from (
        select jsonb_build_object(
          'segment_id', a.segment_id,
          'video_id', a.video_id,
          'youtube_video_id', v.youtube_video_id,
          'title', v.title,
          'start_seconds', coalesce(seg.start_seconds, 0),
          'trecho', left(coalesce(seg.segment_text, ''), 160),
          'vezes', a.vezes
        ) as x
        from assistido a
        join public.videos v on v.id = a.video_id
        left join public.video_segments seg on seg.id = a.segment_id
        order by a.vezes desc limit 15
      ) t
    ), '[]'::jsonb),

    'videos_mais_recomendados', coalesce((
      select jsonb_agg(x order by (x->>'recomendacoes')::int desc)
      from (
        select jsonb_build_object(
          'video_id', v.id,
          'youtube_video_id', v.youtube_video_id,
          'title', v.title,
          'thumbnail_url', v.thumbnail_url,
          'recomendacoes', sum(rec.vezes),
          'visualizacoes', coalesce((select sum(a.vezes) from assistido a where a.video_id = v.id), 0)
        ) as x
        from recomendado rec
        join public.videos v on v.id = rec.video_id
        group by v.id, v.youtube_video_id, v.title, v.thumbnail_url
        order by sum(rec.vezes) desc limit 12
      ) t
    ), '[]'::jsonb),

    'buscas_sem_resultado', coalesce((
      select jsonb_agg(x order by x->>'created_at' desc)
      from (
        select jsonb_build_object('query_text', s.query_text, 'created_at', s.created_at) as x
        from public.searches s
        left join public.search_results r on r.search_id = s.id
        where s.created_at between inicio and fim
        group by s.id, s.query_text, s.created_at
        having count(r.id) = 0
        order by s.created_at desc limit 20
      ) t
    ), '[]'::jsonb)
  ) into resultado;

  return resultado;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_cargo_insights(from_date timestamp with time zone DEFAULT NULL::timestamp with time zone, to_date timestamp with time zone DEFAULT NULL::timestamp with time zone, filter_commercial_role text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  resultado jsonb;
  inicio timestamptz := coalesce(from_date, now() - interval '90 days');
  fim timestamptz := coalesce(to_date, now());
begin
  if not public.is_concer_staff() then
    raise exception 'Acesso restrito à equipe Concer.' using errcode = '42501';
  end if;

  with pessoa as (
    select p.id, coalesce(p.cargo, 'nao_informado') as cargo, p.commercial_role
    from public.profiles p
    where not p.is_internal
      and (filter_commercial_role is null or p.commercial_role = filter_commercial_role)
  ),
  busca as (
    select s.id, s.detected_topics, pe.cargo
    from public.searches s
    join pessoa pe on pe.id = s.profile_id
    where s.created_at between inicio and fim
  ),
  tema as (
    select unnest(coalesce(b.detected_topics, array[]::text[])) as topico, b.cargo
    from busca b
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('de', inicio, 'ate', fim),

    -- quantos cadastros por cargo, e a qual régua cada um responde
    'pessoas_por_cargo', coalesce((
      select jsonb_agg(x order by (x->>'total')::int desc)
      from (
        select jsonb_build_object(
          'cargo', cargo,
          'commercial_role', max(commercial_role),
          'total', count(*)
        ) as x
        from pessoa group by cargo
      ) t
    ), '[]'::jsonb),

    -- a pergunta que o cargo veio responder: quem procura o quê, em detalhe
    'temas_por_cargo', coalesce((
      select jsonb_agg(x order by (x->>'total')::int desc)
      from (
        select jsonb_build_object(
          'cargo', cargo,
          'total', sum(total),
          'temas', jsonb_agg(jsonb_build_object('topico', topico, 'total', total) order by total desc)
        ) as x
        from (
          select cargo, topico, count(*) as total
          from tema where topico is not null and topico <> ''
          group by cargo, topico
        ) c
        group by cargo
      ) t
    ), '[]'::jsonb),

    'buscas_no_periodo', (select count(*) from busca)
  ) into resultado;

  return resultado;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_contexto_insights(from_date timestamp with time zone DEFAULT NULL::timestamp with time zone, to_date timestamp with time zone DEFAULT NULL::timestamp with time zone, filter_commercial_role text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  resultado jsonb;
  inicio timestamptz := coalesce(from_date, now() - interval '90 days');
  fim timestamptz := coalesce(to_date, now());
begin
  if not public.is_concer_staff() then
    raise exception 'Acesso restrito à equipe Concer.' using errcode = '42501';
  end if;

  with base as (
    select
      s.id,
      s.profile_id,
      s.query_text,
      s.context_question,
      s.context_answer,
      s.context_answered_at,
      s.plan_has_context,
      s.created_at,
      p.commercial_role,
      (select count(*) from public.video_views w where w.search_id = s.id) as aberturas
    from public.searches s
    join public.profiles p on p.id = s.profile_id and not p.is_internal
    where s.created_at between inicio and fim
      and (filter_commercial_role is null or p.commercial_role = filter_commercial_role)
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('de', inicio, 'ate', fim),

    'funil', (
      select jsonb_build_object(
        'buscas', count(*),
        'com_pergunta', count(*) filter (where context_question is not null),
        'responderam', count(*) filter (where context_answer is not null),
        'planos_refinados', count(*) filter (where plan_has_context)
      )
      from base
    ),

    'por_perfil', coalesce((
      select jsonb_agg(jsonb_build_object(
        'perfil', commercial_role,
        'com_pergunta', com_pergunta,
        'responderam', responderam
      ) order by responderam desc)
      from (
        select
          commercial_role,
          count(*) filter (where context_question is not null) as com_pergunta,
          count(*) filter (where context_answer is not null) as responderam
        from base
        group by commercial_role
      ) t
    ), '[]'::jsonb),

    -- Média de trechos abertos por busca, dos dois lados. Null quando não há
    -- busca do lado: 0 diria "ninguém abriu" onde a verdade é "não houve caso".
    'efeito', (
      select jsonb_build_object(
        'com_contexto', jsonb_build_object(
          'buscas', count(*) filter (where plan_has_context),
          'aberturas_por_busca', round(
            avg(aberturas) filter (where plan_has_context)::numeric, 2
          )
        ),
        'sem_contexto', jsonb_build_object(
          'buscas', count(*) filter (where not plan_has_context),
          'aberturas_por_busca', round(
            avg(aberturas) filter (where not plan_has_context)::numeric, 2
          )
        )
      )
      from base
    ),

    'ultimas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'busca_id', id,
        'profile_id', profile_id,
        'perfil', commercial_role,
        'dor', query_text,
        'pergunta', context_question,
        'resposta', context_answer,
        'respondida_em', context_answered_at
      ) order by context_answered_at desc)
      from (
        select * from base
        where context_answer is not null
        order by context_answered_at desc
        limit 20
      ) u
    ), '[]'::jsonb),

    -- Perguntas que ninguém respondeu, para a equipe ver o que não engaja.
    'ignoradas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'dor', query_text,
        'pergunta', context_question,
        'buscado_em', created_at
      ) order by created_at desc)
      from (
        select * from base
        where context_question is not null and context_answer is null
        order by created_at desc
        limit 10
      ) g
    ), '[]'::jsonb)
  ) into resultado;

  return resultado;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_cta_insights(from_date timestamp with time zone DEFAULT NULL::timestamp with time zone, to_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  resultado jsonb;
  inicio timestamptz := coalesce(from_date, now() - interval '90 days');
  fim timestamptz := coalesce(to_date, now());
begin
  if not public.is_concer_staff() then
    raise exception 'Acesso restrito à equipe Concer.' using errcode = '42501';
  end if;

  with exposicao as (
    -- Uma linha por plano que levou o convite. `[[solucao:` é o marcador que o
    -- modelo grava; o título é o fallback para o plano que saiu sem marcador.
    select
      s.id as search_id,
      s.profile_id,
      s.detected_topics,
      s.created_at
    from public.searches s
    join public.profiles p on p.id = s.profile_id and not p.is_internal
    where s.created_at between inicio and fim
      and s.action_plan is not null
      and (s.action_plan like '%[[solucao:%' or s.action_plan like '%Como a IA acelera%')
      and p.commercial_role in ('dono_empresa', 'gestor_comercial')
  ),
  clique as (
    select c.*, p.commercial_role, p.cargo
    from public.cta_clicks c
    join public.profiles p on p.id = c.profile_id and not p.is_internal
    where c.created_at between inicio and fim
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('de', inicio, 'ate', fim),

    'planos_com_convite', (select count(*) from exposicao),
    'pessoas_que_viram', (select count(distinct profile_id) from exposicao),
    'cliques', (select count(*) from clique),
    'pessoas_que_clicaram', (select count(distinct profile_id) from clique),
    'taxa', (
      select round(
        (select count(distinct profile_id) from clique)::numeric
          / nullif((select count(distinct profile_id) from exposicao), 0), 3)
    ),

    -- Converte melhor com dono ou com gestor? É o que decide para quem o
    -- lançamento fala primeiro.
    'por_perfil', coalesce((
      select jsonb_agg(x order by (x->>'viram')::int desc)
      from (
        select jsonb_build_object(
          'perfil', p.commercial_role,
          'viram', count(distinct e.profile_id),
          'clicaram', count(distinct c.profile_id)
        ) as x
        from public.profiles p
        left join exposicao e on e.profile_id = p.id
        left join clique c on c.profile_id = p.id
        where not p.is_internal
          and p.commercial_role in ('dono_empresa', 'gestor_comercial')
        group by p.commercial_role
        having count(distinct e.profile_id) > 0 or count(distinct c.profile_id) > 0
      ) t
    ), '[]'::jsonb),

    -- Depois de QUAL dor a pessoa clica. Vira pauta de conteúdo e argumento
    -- de campanha, não só número de relatório.
    'por_tema', coalesce((
      select jsonb_agg(x order by (x->>'cliques')::int desc)
      from (
        select jsonb_build_object('tema', tema, 'cliques', count(*)) as x
        from clique c
        join public.searches s on s.id = c.search_id,
             unnest(coalesce(s.detected_topics, array[]::text[])) tema
        group by tema
        limit 15
      ) t
    ), '[]'::jsonb),

    -- Quem clicou, para a equipe poder ligar. A lista é curta de propósito:
    -- painel de dashboard é leitura, o trabalho pessoa a pessoa é em /admin/leads.
    'ultimos', coalesce((
      select jsonb_agg(x order by x->>'clicado_em' desc)
      from (
        select jsonb_build_object(
          'profile_id', c.profile_id,
          'nome', p.full_name,
          'cargo', p.cargo,
          'perfil', c.commercial_role,
          'dor', s.query_text,
          'clicado_em', c.created_at
        ) as x
        from clique c
        join public.profiles p on p.id = c.profile_id and not p.is_internal
        left join public.searches s on s.id = c.search_id
        order by c.created_at desc
        limit 10
      ) t
    ), '[]'::jsonb),

    'serie', coalesce((
      select jsonb_agg(jsonb_build_object('dia', d, 'cliques', n) order by d)
      from (
        select created_at::date as d, count(*) as n
        from clique group by created_at::date
      ) t
    ), '[]'::jsonb)
  ) into resultado;

  return resultado;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_engagement_insights(from_date timestamp with time zone DEFAULT NULL::timestamp with time zone, to_date timestamp with time zone DEFAULT NULL::timestamp with time zone, filter_commercial_role text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  resultado jsonb;
  inicio timestamptz := coalesce(from_date, now() - interval '90 days');
  fim timestamptz := coalesce(to_date, now());
begin
  if not public.is_concer_staff() then
    raise exception 'Acesso restrito à equipe Concer.' using errcode = '42501';
  end if;

  with alvo as (
    select p.id, p.created_at
    from public.profiles p
    where not p.is_internal
      and (filter_commercial_role is null or p.commercial_role = filter_commercial_role)
  ),
  dia as (
    select generate_series(date_trunc('day', inicio), date_trunc('day', fim), interval '1 day')::date as d
  ),
  busca as (
    select s.id, s.profile_id, s.detected_topics, s.action_plan, s.created_at
    from public.searches s
    join alvo a on a.id = s.profile_id
    where s.created_at between inicio and fim
  ),
  -- relevância de cada busca: o melhor trecho que ela conseguiu devolver.
  -- A média de todos os trechos puniria uma busca boa que trouxe 6 resultados
  -- sendo o primeiro ótimo, que é exatamente o comportamento desejado.
  relevancia_da_busca as (
    select b.id, max(r.similarity_score) as melhor
    from busca b
    join public.search_results r on r.search_id = b.id
    group by b.id
  ),
  tema_busca as (
    select unnest(coalesce(b.detected_topics, array[]::text[])) as topico, b.id
    from busca b
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('de', inicio, 'ate', fim),

    -- ------------------------------------------------------------
    -- Crescimento: uma linha por dia, com zero nos dias sem movimento
    -- (sem os zeros o gráfico mente, porque une dois picos distantes).
    -- ------------------------------------------------------------
    'serie', coalesce((
      select jsonb_agg(jsonb_build_object(
        'dia', d.d,
        'cadastros', (select count(*) from alvo a where a.created_at::date = d.d),
        'buscas',    (select count(*) from public.searches s join alvo a on a.id = s.profile_id
                      where s.created_at::date = d.d),
        'aberturas', (select count(*) from public.video_views w join alvo a on a.id = w.profile_id
                      where w.created_at::date = d.d)
      ) order by d.d)
      from dia d
    ), '[]'::jsonb),

    -- ------------------------------------------------------------
    -- Funil de ativação, sobre a base inteira e não sobre o período:
    -- é a leitura da tese do produto, não do mês.
    -- ------------------------------------------------------------
    'funil', (
      select jsonb_build_object(
        'cadastraram', (select count(*) from alvo),
        'buscaram',    (select count(distinct s.profile_id) from public.searches s join alvo a on a.id = s.profile_id),
        'abriram',     (select count(distinct w.profile_id) from public.video_views w join alvo a on a.id = w.profile_id),
        'voltaram',    (
          select count(*) from (
            select s.profile_id from public.searches s join alvo a on a.id = s.profile_id
            group by s.profile_id having count(distinct s.created_at::date) > 1
          ) t
        )
      )
    ),

    -- ------------------------------------------------------------
    -- Qualidade da busca no período
    -- ------------------------------------------------------------
    'qualidade', (
      select jsonb_build_object(
        'buscas', (select count(*) from busca),
        'buscas_com_plano', (select count(*) from busca where action_plan is not null),
        'buscas_sem_resultado', (
          select count(*) from busca b
          where not exists (select 1 from public.search_results r where r.search_id = b.id)
        ),
        'relevancia_media', (select round(avg(melhor)::numeric, 3) from relevancia_da_busca),
        'relevancia_minima', (select round(min(melhor)::numeric, 3) from relevancia_da_busca),
        'recomendacoes', (
          select count(*) from public.search_results r
          join busca b on b.id = r.search_id
        ),
        'aberturas', (select count(*) from public.video_views w join alvo a on a.id = w.profile_id
                      where w.created_at between inicio and fim),
        'buscas_por_pessoa', (
          select round(count(*)::numeric / nullif(count(distinct profile_id), 0), 1) from busca
        )
      )
    ),

    -- ------------------------------------------------------------
    -- Pauta de conteúdo: muito buscado + acervo respondendo mal.
    -- Ordenado por buscas, com a relevância ao lado para leitura.
    -- ------------------------------------------------------------
    'demanda_por_tema', coalesce((
      select jsonb_agg(x order by (x->>'buscas')::int desc)
      from (
        select jsonb_build_object(
          'topico', t.topico,
          'buscas', count(distinct t.id),
          'relevancia_media', round(avg(rb.melhor)::numeric, 3),
          'trechos_no_acervo', (
            select count(*) from public.video_segments vs
            where vs.topic_tags @> array[t.topico]
          )
        ) as x
        from tema_busca t
        left join relevancia_da_busca rb on rb.id = t.id
        where t.topico is not null and t.topico <> ''
        group by t.topico
        order by count(distinct t.id) desc
        limit 15
      ) y
    ), '[]'::jsonb),

    -- ------------------------------------------------------------
    -- Acervo ocioso: indexado e nunca recomendado. É conteúdo pronto,
    -- já pago, que a busca nunca encontrou. Vale rever título ou tema.
    -- ------------------------------------------------------------
    'acervo', (
      select jsonb_build_object(
        'indexados', (select count(*) from public.videos where indexed_at is not null),
        'ja_recomendados', (
          select count(distinct r.video_id) from public.search_results r
          join busca b on b.id = r.search_id
        ),
        'nunca_recomendados', (
          select count(*) from public.videos v
          where v.indexed_at is not null
            and not exists (
              select 1 from public.search_results r join busca b on b.id = r.search_id
              where r.video_id = v.id
            )
        ),
        'amostra', coalesce((
          select jsonb_agg(jsonb_build_object(
            'video_id', v.id,
            'youtube_video_id', v.youtube_video_id,
            'title', v.title,
            'thumbnail_url', v.thumbnail_url,
            'trechos', (select count(*) from public.video_segments s where s.video_id = v.id)
          ) order by v.published_at desc nulls last)
          from (
            select * from public.videos v2
            where v2.indexed_at is not null
              and not exists (
                select 1 from public.search_results r join busca b on b.id = r.search_id
                where r.video_id = v2.id
              )
            order by v2.published_at desc nulls last
            limit 6
          ) v
        ), '[]'::jsonb)
      )
    ),

    -- ------------------------------------------------------------
    -- Recorrência: em quantos dias distintos cada pessoa buscou.
    -- Uma vez só é curiosidade; voltar é hábito, e hábito é o que
    -- sustenta a audiência que vai ser oferecida a um parceiro.
    -- ------------------------------------------------------------
    'recorrencia', coalesce((
      select jsonb_agg(jsonb_build_object('dias_ativos', dias_ativos, 'pessoas', pessoas)
                       order by dias_ativos)
      from (
        select dias_ativos, count(*) as pessoas
        from (
          -- 5+ vira um balde só: além disso a cauda é longa e some no gráfico
          select s.profile_id, least(count(distinct s.created_at::date), 5) as dias_ativos
          from public.searches s join alvo a on a.id = s.profile_id
          group by s.profile_id
        ) por_pessoa
        group by dias_ativos
      ) p
    ), '[]'::jsonb)
  ) into resultado;

  return resultado;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_origem_insights(from_date timestamp with time zone DEFAULT NULL::timestamp with time zone, to_date timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  resultado jsonb;
  inicio timestamptz := coalesce(from_date, now() - interval '90 days');
  fim timestamptz := coalesce(to_date, now());
begin
  if not public.is_concer_staff() then
    raise exception 'Acesso restrito à equipe Concer.' using errcode = '42501';
  end if;

  with lead as (
    select
      l.id,
      l.profile_id,
      public.origem_do_lead(l.utm_source, l.referrer) as origem,
      l.utm_medium,
      l.utm_campaign,
      l.created_at,
      -- Lead que nunca buscou é e-mail, não lead qualificado: a origem só
      -- vale a pena se a gente souber quantos dela chegaram a usar o produto.
      exists (select 1 from public.searches s where s.profile_id = l.profile_id) as ativou
    from public.leads l
    where l.created_at between inicio and fim
      and not public.perfil_interno(l.profile_id)
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('de', inicio, 'ate', fim),
    'total_leads', (select count(*) from lead),

    'por_origem', coalesce((
      select jsonb_agg(x order by (x->>'leads')::int desc)
      from (
        select jsonb_build_object(
          'origem', origem,
          'leads', count(*),
          'ativaram', count(*) filter (where ativou),
          'taxa_ativacao', round(
            count(*) filter (where ativou)::numeric / nullif(count(*), 0), 3
          )
        ) as x
        from lead group by origem
      ) t
    ), '[]'::jsonb),

    -- Campanha só faz sentido junto do meio: "instagram / stories / lancamento"
    'por_campanha', coalesce((
      select jsonb_agg(x order by (x->>'leads')::int desc)
      from (
        select jsonb_build_object(
          'origem', origem,
          'meio', coalesce(utm_medium, 'sem meio'),
          'campanha', utm_campaign,
          'leads', count(*),
          'ativaram', count(*) filter (where ativou)
        ) as x
        from lead
        where utm_campaign is not null and utm_campaign <> ''
        group by origem, utm_medium, utm_campaign
        limit 30
      ) t
    ), '[]'::jsonb),

    -- Série para ver campanha subindo ou morrendo
    'serie', coalesce((
      select jsonb_agg(jsonb_build_object('dia', d, 'origem', origem, 'leads', n)
                       order by d, origem)
      from (
        select created_at::date as d, origem, count(*) as n
        from lead group by created_at::date, origem
      ) t
    ), '[]'::jsonb)
  ) into resultado;

  return resultado;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Lista de leads: filtros de verdade.
--
-- A lista tinha busca livre e perfil comercial. Quem trabalha nela pergunta
-- outras coisas: quem é diretor, quem veio do WhatsApp, quem está parado na
-- régua, quem buscou objeção de preço, quem se cadastrou e nunca voltou. Cada
-- um desses recortes existia só na cabeça de quem lia a lista inteira.
--
-- Todos os filtros combinam entre si e nenhum é obrigatório. `p_incluir_internos`
-- existe para a equipe conseguir ver as próprias contas quando quiser conferir
-- um teste, e vem falso por padrão, que é a leitura do dia a dia.
--
-- A assinatura antiga é derrubada de propósito: manter as duas com parâmetros
-- default deixaria a chamada ambígua para o PostgREST.
-- ---------------------------------------------------------------------------

drop function if exists public.get_leads(text, text, integer);

create or replace function public.get_leads(
  p_busca text default null,
  p_perfil text default null,
  p_limit integer default 100,
  p_cargo text default null,
  p_origem text default null,
  p_regua text default null,
  p_tema text default null,
  p_faixa text default null,
  p_atividade text default null,
  p_desde timestamptz default null,
  p_incluir_internos boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  resultado jsonb;
  termo text := nullif(btrim(coalesce(p_busca, '')), '');
begin
  if not public.is_concer_staff() then
    raise exception 'Acesso restrito à equipe Concer.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(x order by (x->>'score')::int desc, x->>'ultima_atividade' desc nulls last), '[]'::jsonb)
  into resultado
  from (
    select jsonb_build_object(
      'profile_id', p.id,
      'nome', p.full_name,
      'email', p.email,
      'whatsapp', p.whatsapp,
      'cargo', p.cargo,
      'perfil_comercial', p.commercial_role,
      'papel', p.role,
      'interno', p.is_internal,
      'cadastrado_em', p.created_at,
      'lead_id', l.id,
      'status_nutricao', l.nurture_status,
      'nutricao_enviada_em', l.nurture_sent_at,
      -- A origem sai da mesma função do relatório de captação: UTM, senão o
      -- domínio do referrer, senão 'direto'. Nunca o campo cru.
      'origem', public.origem_do_lead(l.utm_source, l.referrer),
      'campanha', l.utm_campaign,
      'score', (sc.detalhe->>'total')::int,
      'faixa', public.faixa_do_score((sc.detalhe->>'total')::int),
      'total_buscas', (select count(*) from public.searches s where s.profile_id = p.id),
      'trechos_abertos', (select count(*) from public.video_views w where w.profile_id = p.id),
      'ultima_busca', (select max(s.created_at) from public.searches s where s.profile_id = p.id),
      'ultima_atividade', greatest(
        p.created_at,
        coalesce((select max(s.created_at) from public.searches s where s.profile_id = p.id), p.created_at),
        coalesce((select max(w.created_at) from public.video_views w where w.profile_id = p.id), p.created_at)
      ),
      'temas', coalesce((
        select jsonb_agg(distinct t)
        from public.searches s, unnest(coalesce(s.detected_topics, array[]::text[])) t
        where s.profile_id = p.id
      ), '[]'::jsonb),
      -- A dor mais recente é o que faz sentido ler numa lista: é o assunto
      -- que a pessoa tem na cabeça agora, não o de três semanas atrás.
      'ultima_dor', (
        select s.query_text from public.searches s
        where s.profile_id = p.id order by s.created_at desc limit 1
      )
    ) as x
    from public.profiles p
    left join public.leads l on l.profile_id = p.id
    -- lateral para o score sair de UMA avaliação por pessoa: chamar a função
    -- no select, no order by e na faixa custaria três varreduras por linha.
    cross join lateral (select public.score_do_lead_detalhe(p.id) as detalhe) sc
    where (p_incluir_internos or not p.is_internal)
      and (p_perfil is null or p.commercial_role = p_perfil)
      and (p_cargo is null or coalesce(p.cargo, 'nao_informado') = p_cargo)
      and (p_desde is null or p.created_at >= p_desde)
      and (p_origem is null or public.origem_do_lead(l.utm_source, l.referrer) = p_origem)
      -- 'sem_regua' é quem nunca entrou (não tem linha em leads), diferente de
      -- quem entrou e falhou. Na lista as duas situações pedem ação oposta.
      and (
        p_regua is null
        or (p_regua = 'sem_regua' and l.id is null)
        or l.nurture_status = p_regua
      )
      and (
        p_faixa is null
        or public.faixa_do_score((sc.detalhe->>'total')::int) = p_faixa
      )
      and (
        p_tema is null
        or exists (
          select 1 from public.searches s
          where s.profile_id = p.id and p_tema = any(coalesce(s.detected_topics, array[]::text[]))
        )
      )
      and (
        p_atividade is null
        or (p_atividade = 'buscou' and exists (select 1 from public.searches s where s.profile_id = p.id))
        or (p_atividade = 'nao_buscou' and not exists (select 1 from public.searches s where s.profile_id = p.id))
        or (p_atividade = 'abriu_trecho' and exists (select 1 from public.video_views w where w.profile_id = p.id))
        or (p_atividade = 'clicou_convite' and exists (select 1 from public.cta_clicks c where c.profile_id = p.id))
      )
      and (
        termo is null
        or p.full_name ilike '%' || termo || '%'
        or p.email ilike '%' || termo || '%'
        or p.whatsapp ilike '%' || termo || '%'
        or exists (
          select 1 from public.searches s
          where s.profile_id = p.id and s.query_text ilike '%' || termo || '%'
        )
      )
    order by (sc.detalhe->>'total')::int desc, p.created_at desc
    limit greatest(1, least(p_limit, 500))
  ) t;

  return resultado;
end;
$function$;

revoke all on function public.get_leads(text, text, integer, text, text, text, text, text, text, timestamptz, boolean) from public, anon;
grant execute on function public.get_leads(text, text, integer, text, text, text, text, text, text, timestamptz, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- get_leads_facetas: o que existe para filtrar, com quantos leads cada opção
-- tem. Cargo e tema são listas fixas do produto e a tela já sabe traduzir, mas
-- ORIGEM é aberta (qualquer utm_source, qualquer domínio de referrer): sem esta
-- função a tela precisaria chutar uma lista, e um canal novo ficaria invisível
-- justamente na semana em que ele começou a trazer gente.
--
-- Vem com contagem porque filtro que devolve zero é filtro que não deveria ter
-- sido oferecido.
-- ---------------------------------------------------------------------------

create or replace function public.get_leads_facetas()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  resultado jsonb;
begin
  if not public.is_concer_staff() then
    raise exception 'Acesso restrito à equipe Concer.' using errcode = '42501';
  end if;

  with pessoa as (
    select p.id, p.cargo, p.commercial_role, l.utm_source, l.referrer, l.id as lead_id, l.nurture_status
    from public.profiles p
    left join public.leads l on l.profile_id = p.id
    where not p.is_internal
  )
  select jsonb_build_object(
    'total', (select count(*) from pessoa),
    'origens', coalesce((
      select jsonb_agg(jsonb_build_object('valor', origem, 'total', n) order by n desc)
      from (
        select public.origem_do_lead(utm_source, referrer) as origem, count(*) as n
        from pessoa group by 1
      ) o
    ), '[]'::jsonb),
    'cargos', coalesce((
      select jsonb_agg(jsonb_build_object('valor', cargo, 'total', n) order by n desc)
      from (
        select coalesce(cargo, 'nao_informado') as cargo, count(*) as n
        from pessoa group by 1
      ) c
    ), '[]'::jsonb),
    'temas', coalesce((
      select jsonb_agg(jsonb_build_object('valor', topico, 'total', n) order by n desc)
      from (
        select t as topico, count(distinct s.profile_id) as n
        from public.searches s
        join pessoa pe on pe.id = s.profile_id,
             unnest(coalesce(s.detected_topics, array[]::text[])) t
        group by t
      ) tm
    ), '[]'::jsonb),
    'reguas', coalesce((
      select jsonb_agg(jsonb_build_object('valor', situacao, 'total', n) order by n desc)
      from (
        select coalesce(nurture_status, 'sem_regua') as situacao, count(*) as n
        from pessoa group by 1
      ) r
    ), '[]'::jsonb)
  ) into resultado;

  return resultado;
end;
$function$;

revoke all on function public.get_leads_facetas() from public, anon;
grant execute on function public.get_leads_facetas() to authenticated;
