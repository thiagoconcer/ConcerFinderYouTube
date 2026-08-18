-- ---------------------------------------------------------------------------
-- Score do lead: 0 a 100, um número só.
--
-- O painel já dizia QUEM é a pessoa (cargo), O QUE ela procurou (temas) e DE
-- ONDE veio (origem). Faltava a pergunta que a equipe faz na prática: por quem
-- eu começo? Com a base crescendo, ler lead a lead deixa de ser possível.
--
-- O score responde a duas perguntas de uma vez, por pedido do Bruno:
-- quem vale uma abordagem da Concer e quem sustenta um recorte de audiência
-- para empresa parceira. Por isso cargo e comportamento pesam juntos.
--
-- COMO É FORMADO (o desenho importa mais que os números):
--
--   A. Quem é (0-30)          dono 30, gestor 22, vendedor 12, sem cargo 8.
--   B. O que fez (0-45)       buscas (até 20), dias distintos de volta (até
--                             15), trechos abertos (até 10).
--   C. Quando (0-15)          7 dias 15, 30 dias 10, 90 dias 5, além disso 0.
--   D. Foco (0-10)            tema dominante em 60%+ das buscas vale 10;
--                             busca dispersa vale 4; menos de 2 buscas, 0.
--
-- COMPORTAMENTO PESA MAIS QUE CARGO (45+15+10 contra 30), de propósito. Dono de
-- empresa que se cadastrou e nunca voltou chega no máximo a 30, e é frio. Isso
-- é a mesma régua do relatório de origem: quem traz volume e não ativa é
-- tráfego, não audiência. Cargo é promessa, comportamento é prova.
--
-- RECORRÊNCIA VALE MAIS QUE VOLUME: dez buscas num dia só é uma sessão de
-- curiosidade; três buscas em três dias diferentes é alguém com uma dor que
-- não passou. Por isso "dias distintos" é um componente separado de "buscas".
--
-- A função é STABLE e SEM security definer de propósito. Quem chama de dentro
-- de get_leads (que já é definer e checa staff) enxerga tudo; um usuário comum
-- que chamar direto com o id de outra pessoa esbarra na RLS e calcula em cima
-- de zero linha. O score não vira uma janela para o comportamento alheio.
-- ---------------------------------------------------------------------------

create or replace function public.score_do_lead_detalhe(p_profile_id uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  with uso as (
    select
      count(*) as buscas,
      count(distinct (created_at at time zone 'America/Sao_Paulo')::date) as dias,
      max(created_at) as ultima
    from public.searches
    where profile_id = p_profile_id
  ),
  aberturas as (
    select count(*) as trechos
    from public.video_views
    where profile_id = p_profile_id
  ),
  foco as (
    -- Concentração do tema dominante entre todos os temas detectados.
    select max(vezes)::numeric / nullif(sum(vezes), 0) as concentracao
    from (
      select t, count(*) as vezes
      from public.searches s, unnest(coalesce(s.detected_topics, array[]::text[])) t
      where s.profile_id = p_profile_id
      group by t
    ) x
  ),
  quem as (
    select coalesce(public.perfil_do_cargo(p.cargo), p.commercial_role) as perfil
    from public.profiles p
    where p.id = p_profile_id
  )
  ,
  pontos as (
    select
      case (select perfil from quem)
        when 'dono_empresa'     then 30
        when 'gestor_comercial' then 22
        when 'vendedor'         then 12
        else 8
      end as cargo,
      least(20, (select buscas from uso) * 5)
        + least(15, greatest(0, (select dias from uso) - 1) * 5)
        + least(10, (select trechos from aberturas) * 2) as atividade,
      case
        when (select ultima from uso) is null then 0
        when (select ultima from uso) > now() - interval '7 days'  then 15
        when (select ultima from uso) > now() - interval '30 days' then 10
        when (select ultima from uso) > now() - interval '90 days' then 5
        else 0
      end as recencia,
      case
        when (select buscas from uso) < 2 then 0
        when coalesce((select concentracao from foco), 0) >= 0.6 then 10
        else 4
      end as foco
  )
  select jsonb_build_object(
    'total', least(100, greatest(0, cargo + atividade + recencia + foco))::int,
    'cargo', cargo,
    'atividade', atividade,
    'recencia', recencia,
    'foco', foco,
    'buscas', (select buscas from uso),
    'dias_ativos', (select dias from uso),
    'trechos_abertos', (select trechos from aberturas)
  )
  from pontos;
$$;

comment on function public.score_do_lead_detalhe(uuid) is
  'Composição do score do lead, para a tela poder explicar o número sem '
  'reimplementar a regra em TypeScript (duas cópias divergiriam no primeiro ajuste).';

-- O score é a leitura do detalhe, nunca um segundo cálculo: uma regra só.
create or replace function public.score_do_lead(p_profile_id uuid)
returns int
language sql
stable
set search_path = public
as $$
  select (public.score_do_lead_detalhe(p_profile_id)->>'total')::int;
$$;

comment on function public.score_do_lead(uuid) is
  'Score 0-100 do lead: cargo (0-30), atividade (0-45), recência (0-15) e foco '
  'de tema (0-10). Comportamento pesa mais que cargo de propósito.';

-- Faixa por extenso. Existe para o painel e o data lake contarem a mesma
-- história: dois cortes diferentes de "quente" seria a divergência que a
-- função única existe para evitar.
create or replace function public.faixa_do_score(p_score int)
returns text
language sql
immutable
as $$
  select case
    when p_score >= 70 then 'quente'
    when p_score >= 40 then 'morno'
    else 'frio'
  end;
$$;

-- ---------------------------------------------------------------------------
-- get_leads: devolve o score e passa a ordenar por ele.
--
-- De quebra, corrige um erro que só apareceria com a base grande: o `limit`
-- ficava numa subconsulta SEM order by, e a ordenação por última atividade era
-- aplicada DEPOIS, no jsonb_agg. Com mais de 100 pessoas, o painel pegaria 100
-- quaisquer e ordenaria essas, dando a impressão de mostrar as mais recentes.
-- Agora a ordem decide antes do corte, que é o único jeito de um "top 100"
-- significar alguma coisa.
-- ---------------------------------------------------------------------------

create or replace function public.get_leads(
  p_busca text default null,
  p_perfil text default null,
  p_limit integer default 100
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
      'cadastrado_em', p.created_at,
      'lead_id', l.id,
      'status_nutricao', l.nurture_status,
      'nutricao_enviada_em', l.nurture_sent_at,
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
    where (p_perfil is null or p.commercial_role = p_perfil)
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

-- ---------------------------------------------------------------------------
-- get_lead_detail: o score com as parcelas à vista.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_lead_detail(p_profile_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  resultado jsonb;
begin
  if not public.is_concer_staff() then
    raise exception 'Acesso restrito à equipe Concer.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'pessoa', (
      select jsonb_build_object(
        'profile_id', p.id,
        'nome', p.full_name,
        'email', p.email,
        'whatsapp', p.whatsapp,
        'cargo', p.cargo,
        'perfil_comercial', p.commercial_role,
        'papel', p.role,
        'cadastrado_em', p.created_at,
        'status_nutricao', l.nurture_status,
        'nutricao_enviada_em', l.nurture_sent_at
      )
      from public.profiles p
      left join public.leads l on l.profile_id = p.id
      where p.id = p_profile_id
    ),

    -- O score vem com a composição junto. Número solto ninguém confia nem
    -- contesta; com as parcelas à vista, a equipe vê que a pessoa pontuou por
    -- ter voltado três dias seguidos, e não por ser dono de empresa.
    'score', public.score_do_lead_detalhe(p_profile_id),
    'faixa', public.faixa_do_score((public.score_do_lead_detalhe(p_profile_id)->>'total')::int),

    'resumo', (
      select jsonb_build_object(
        'total_buscas', (select count(*) from public.searches s where s.profile_id = p_profile_id),
        'trechos_abertos', (select count(*) from public.video_views w where w.profile_id = p_profile_id),
        'dias_ativos', (
          select count(distinct s.created_at::date) from public.searches s where s.profile_id = p_profile_id
        ),
        'recomendacoes_recebidas', (
          select count(*) from public.search_results r
          join public.searches s on s.id = r.search_id
          where s.profile_id = p_profile_id
        )
      )
    ),

    'buscas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'busca_id', s.id,
        'dor', s.query_text,
        'temas', coalesce(s.detected_topics, array[]::text[]),
        'gerou_plano', (s.action_plan is not null),
        'buscado_em', s.created_at,
        'trechos_recomendados', (select count(*) from public.search_results r where r.search_id = s.id),
        'trechos_abertos', (select count(*) from public.video_views w where w.search_id = s.id)
      ) order by s.created_at desc)
      from public.searches s where s.profile_id = p_profile_id
    ), '[]'::jsonb),

    'aberturas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'video_id', w.video_id,
        'youtube_video_id', v.youtube_video_id,
        'titulo', v.title,
        'inicio_segundos', w.start_seconds,
        'aberto_em', w.created_at
      ) order by w.created_at desc)
      from public.video_views w
      join public.videos v on v.id = w.video_id
      where w.profile_id = p_profile_id
    ), '[]'::jsonb)
  ) into resultado;

  return resultado;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Data lake: o score entra em fato_leads pela MESMA função do painel.
--
-- A stream da Nekt está em extract_all_fields, então as colunas novas entram
-- sozinhas na próxima sincronização, sem mexer na fonte. Duas definições de
-- "lead quente", uma na tela e outra no lago, divergiriam no primeiro ajuste
-- de peso: é o mesmo motivo pelo qual origem_do_lead é uma função só.
-- ---------------------------------------------------------------------------

create or replace view analytics.fato_leads as
  select
    l.id as lead_id,
    l.profile_id as pessoa_id,
    l.commercial_role as perfil_comercial,
    l.nurture_status as status_nutricao,
    l.nurture_sent_at as nutricao_enviada_em,
    l.created_at as gerado_em,
    l.cargo,
    public.origem_do_lead(l.utm_source, l.referrer) as origem,
    l.utm_source,
    l.utm_medium,
    l.utm_campaign,
    l.utm_content,
    l.utm_term,
    l.referrer,
    l.landing_page,
    (public.score_do_lead_detalhe(l.profile_id)->>'total')::int as score,
    public.faixa_do_score((public.score_do_lead_detalhe(l.profile_id)->>'total')::int) as faixa
  from public.leads l;
