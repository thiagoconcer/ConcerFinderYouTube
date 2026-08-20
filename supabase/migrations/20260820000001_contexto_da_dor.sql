-- ---------------------------------------------------------------------------
-- Contexto da dor: a pergunta que o sistema faz antes de refinar o plano.
--
-- O PROBLEMA. O plano nascia de três coisas: a dor em texto, o perfil comercial
-- (vendedor, gestor, dono) e os trechos recuperados. Faltava o que separa um
-- plano executável de um plano genérico: o que a pessoa vende e para quem, por
-- qual canal, o que ela já tentou, o tamanho do time. Sem isso o modelo escreve
-- "estruture seu follow-up", que é verdade e não muda a segunda-feira de
-- ninguém.
--
-- POR QUE PERGUNTA GERADA E NÃO FORMULÁRIO FIXO. Formulário fixo pergunta a
-- mesma coisa para quem descreveu "o cliente some depois da proposta" e para
-- quem descreveu "não passo da secretária", e nos dois casos pergunta o que não
-- muda o plano. A pergunta é gerada a partir da dor E dos trechos que a busca
-- encontrou: o que se quer saber é como aplicar AQUELES vídeos no caso dela.
--
-- A pergunta nunca segura o plano. O plano é gerado assim que a busca termina,
-- com o que existe; a resposta, quando vem, dispara UMA regeração. Por isso
-- `plan_has_context`: sem ela o relatório não consegue separar plano refinado
-- de plano original, e a comparação que justifica a mudança seria adivinhação.
-- ---------------------------------------------------------------------------

alter table public.searches
  add column if not exists context_question text,
  add column if not exists context_options text[],
  add column if not exists context_answer text,
  add column if not exists context_answered_at timestamptz,
  add column if not exists plan_has_context boolean not null default false;

comment on column public.searches.context_question is
  'Pergunta gerada a partir da dor e dos trechos, para refinar o plano.';
comment on column public.searches.context_options is
  'Respostas sugeridas para clicar, geradas junto com a pergunta.';
comment on column public.searches.context_answer is
  'O que a pessoa respondeu (opções escolhidas e/ou texto livre).';
comment on column public.searches.plan_has_context is
  'true quando o plano gravado foi gerado JÁ COM a resposta de contexto.';

-- Índice parcial: os relatórios de contexto só olham as buscas respondidas, e
-- elas são a minoria. Índice cheio em created_at já existe para o resto.
create index if not exists idx_searches_contexto_respondido
  on public.searches (created_at)
  where context_answer is not null;

-- ---------------------------------------------------------------------------
-- get_busca_detail: o que UMA pessoa recebeu numa busca, por inteiro.
--
-- Existe separada de get_lead_detail de propósito. O perfil do lead lista as
-- buscas (dor, data, quantos trechos); carregar junto o plano inteiro e todos
-- os trechos de cada uma delas devolveria centenas de KB para quem tem 40
-- buscas, e quase sempre a equipe quer ler UMA. Esta função é chamada quando a
-- pessoa abre aquela busca na tela.
-- ---------------------------------------------------------------------------

create or replace function public.get_busca_detail(p_search_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  resultado jsonb;
begin
  if not public.is_concer_staff() then
    raise exception 'Acesso restrito à equipe Concer.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'busca', jsonb_build_object(
      'busca_id', s.id,
      'profile_id', s.profile_id,
      'dor', s.query_text,
      'temas', coalesce(s.detected_topics, array[]::text[]),
      'buscado_em', s.created_at,
      'plano', s.action_plan,
      'plano_com_contexto', s.plan_has_context
    ),

    'contexto', jsonb_build_object(
      'pergunta', s.context_question,
      'opcoes', coalesce(s.context_options, array[]::text[]),
      'resposta', s.context_answer,
      'respondida_em', s.context_answered_at
    ),

    -- Os trechos como ela recebeu, na ordem em que apareceram na tela, e com a
    -- informação que a equipe quer de verdade: ela abriu este aqui ou não.
    'trechos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'video_id', r.video_id,
        'youtube_video_id', v.youtube_video_id,
        'titulo', v.title,
        'thumbnail_url', v.thumbnail_url,
        'inicio_segundos', r.start_seconds,
        'relevancia', r.similarity_score,
        'posicao', r.rank_position,
        'trecho', g.segment_text,
        'abriu', exists (
          select 1 from public.video_views w
          where w.search_id = s.id and w.segment_id = r.segment_id
        )
      ) order by r.rank_position)
      from public.search_results r
      join public.videos v on v.id = r.video_id
      left join public.video_segments g on g.id = r.segment_id
      where r.search_id = s.id
    ), '[]'::jsonb)
  ) into resultado
  from public.searches s
  where s.id = p_search_id;

  return resultado;
end;
$$;

revoke all on function public.get_busca_detail(uuid) from public, anon;
grant execute on function public.get_busca_detail(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_contexto_insights: a pergunta de contexto está funcionando?
--
-- Três perguntas, nesta ordem de importância:
--
-- 1. QUANTOS RESPONDEM. Sem isso o resto não se lê. Uma taxa baixa não condena
--    a ideia, mas condena a pergunta: se quase ninguém responde, a pergunta
--    está genérica ou está no lugar errado da tela.
-- 2. O PLANO REFINADO É MAIS USADO? A comparação é trechos abertos por busca,
--    com contexto contra sem contexto. É o proxy honesto de plano melhor: quem
--    achou o plano útil vai assistir o vídeo que ele citou. Vale como sinal, não
--    como prova: quem responde já é mais engajado do que quem ignora.
-- 3. O QUE ESTAVA FALTANDO. A lista de pergunta e resposta é leitura editorial:
--    ela mostra a ambiguidade por trás da dor, que é um nível mais fino do que
--    "as pessoas perguntam sobre objeção de preço".
-- ---------------------------------------------------------------------------

create or replace function public.get_contexto_insights(
  from_date timestamptz default null,
  to_date timestamptz default null,
  filter_commercial_role text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
    join public.profiles p on p.id = s.profile_id
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
$$;

revoke all on function public.get_contexto_insights(timestamptz, timestamptz, text) from public, anon;
grant execute on function public.get_contexto_insights(timestamptz, timestamptz, text) to authenticated;

-- ---------------------------------------------------------------------------
-- get_lead_detail passa a marcar, na lista de buscas, quais tiveram contexto.
-- Só isso muda: o conteúdo da pergunta e do plano vem por get_busca_detail,
-- quando a equipe abrir aquela busca.
-- ---------------------------------------------------------------------------

create or replace function public.get_lead_detail(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
        'respondeu_contexto', (s.context_answer is not null),
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
$$;
