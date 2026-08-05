-- ============================================================
-- ConcerFinder — Camada analítica para o data lake (Nekt)
--
-- Por que views e não as tabelas cruas: o Nekt lê um contrato estável.
-- Se amanhã eu renomear uma coluna em `searches`, a view absorve e o
-- pipeline não quebra. E é aqui que fica explícito o que atravessa a
-- fronteira para fora do Supabase.
--
-- Acesso: papel `nekt_reader`, com SELECT apenas nestas views. Ele não
-- enxerga `public`, não enxerga `auth`, não escreve nada.
--
-- ⚠️ DADO PESSOAL: `dim_pessoas` carrega nome, e-mail e WhatsApp por decisão
-- explícita (entender comportamento da audiência). É a única view com PII.
-- Se um dia a exigência de LGPD apertar, basta trocar esta view por uma
-- versão pseudonimizada: nada mais no pipeline depende de PII.
--
-- Rodar depois de db/schemas.sql, db/rpcs.sql, db/audiencia.sql. Idempotente.
-- ============================================================

create schema if not exists analytics;

comment on schema analytics is
  'Contrato de leitura para o data lake (Nekt). Só views, sem tabela. Único consumidor: nekt_reader.';

-- ============================================================
-- DIMENSÕES
-- ============================================================

/** Pessoas cadastradas. Única view com dado pessoal. */
create or replace view analytics.dim_pessoas as
select
  p.id                as pessoa_id,
  p.full_name         as nome,
  p.email,
  p.whatsapp,
  p.commercial_role   as perfil_comercial,
  p.role              as papel_no_sistema,
  p.created_at        as cadastrado_em,
  l.id                as lead_id,
  l.nurture_status    as status_nutricao,
  l.nurture_sent_at   as nutricao_enviada_em
from public.profiles p
left join public.leads l on l.profile_id = p.id;

comment on view analytics.dim_pessoas is
  'Quem é a audiência. CONTÉM DADO PESSOAL (nome, e-mail, WhatsApp) por decisão explícita.';

/** Vídeos do canal e o estado deles na esteira de ingestão. */
create or replace view analytics.dim_videos as
select
  v.id                  as video_id,
  v.youtube_video_id,
  v.title               as titulo,
  v.published_at        as publicado_em,
  v.duration_seconds    as duracao_segundos,
  v.transcription_status as status_ingestao,
  v.indexed_at          as indexado_em,
  (select count(*) from public.video_segments s where s.video_id = v.id) as total_trechos
from public.videos v;

/** Trechos transcritos. Sem a coluna embedding: 1536 floats por linha, sem valor analítico. */
create or replace view analytics.dim_trechos as
select
  s.id            as trecho_id,
  s.video_id,
  v.title         as video_titulo,
  s.start_seconds as inicio_segundos,
  s.end_seconds   as fim_segundos,
  s.topic_tags    as temas,
  s.segment_text  as texto,
  (s.embedding is not null) as indexado
from public.video_segments s
join public.videos v on v.id = s.video_id;

-- ============================================================
-- FATOS
-- ============================================================

/** Cada dor pesquisada. O centro do comportamento da audiência. */
create or replace view analytics.fato_buscas as
select
  s.id              as busca_id,
  s.profile_id      as pessoa_id,
  p.commercial_role as perfil_comercial,
  s.query_text      as dor_descrita,
  s.detected_topics as temas_detectados,
  (s.action_plan is not null) as gerou_plano,
  s.created_at      as buscado_em,
  (select count(*) from public.search_results r where r.search_id = s.id) as trechos_recomendados,
  (select count(*) from public.video_views w where w.search_id = s.id)    as trechos_abertos
from public.searches s
join public.profiles p on p.id = s.profile_id;

/** Um tema por linha: facilita o "dores mais buscadas" no data lake. */
create or replace view analytics.fato_temas_buscados as
select
  s.id              as busca_id,
  s.profile_id      as pessoa_id,
  p.commercial_role as perfil_comercial,
  unnest(coalesce(s.detected_topics, array[]::text[])) as tema,
  s.created_at      as buscado_em
from public.searches s
join public.profiles p on p.id = s.profile_id;

/** O que a busca recomendou. */
create or replace view analytics.fato_recomendacoes as
select
  r.id               as recomendacao_id,
  r.search_id        as busca_id,
  s.profile_id       as pessoa_id,
  p.commercial_role  as perfil_comercial,
  r.video_id,
  v.title            as video_titulo,
  r.segment_id       as trecho_id,
  r.start_seconds    as inicio_segundos,
  r.similarity_score as relevancia,
  r.rank_position    as posicao,
  r.created_at       as recomendado_em,
  exists (select 1 from public.video_views w where w.segment_id = r.segment_id and w.profile_id = s.profile_id) as foi_aberto
from public.search_results r
join public.searches s on s.id = r.search_id
join public.profiles p on p.id = s.profile_id
join public.videos v on v.id = r.video_id;

/** O que a pessoa realmente abriu. */
create or replace view analytics.fato_visualizacoes as
select
  w.id              as visualizacao_id,
  w.profile_id      as pessoa_id,
  p.commercial_role as perfil_comercial,
  w.video_id,
  v.title           as video_titulo,
  w.segment_id      as trecho_id,
  w.search_id       as busca_id,
  w.start_seconds   as inicio_segundos,
  w.created_at      as aberto_em
from public.video_views w
join public.profiles p on p.id = w.profile_id
join public.videos v on v.id = w.video_id;

/** Leads e o estado da régua de nutrição. */
create or replace view analytics.fato_leads as
select
  l.id              as lead_id,
  l.profile_id      as pessoa_id,
  l.commercial_role as perfil_comercial,
  l.nurture_status  as status_nutricao,
  l.nurture_sent_at as nutricao_enviada_em,
  l.created_at      as gerado_em
from public.leads l;

/** Saúde da esteira de ingestão. */
create or replace view analytics.fato_ingestao as
select
  i.id, i.run_type as etapa, i.status, i.videos_processed as videos_processados,
  i.error_message as erro, i.started_at as iniciado_em, i.finished_at as finalizado_em
from public.ingestion_runs i;

-- ============================================================
-- AGREGADOS PRONTOS (o mesmo que o painel mostra)
-- ============================================================

/** Dores mais buscadas por perfil comercial. */
create or replace view analytics.vw_dores_por_perfil as
select
  perfil_comercial,
  tema,
  count(*)                        as buscas,
  count(distinct pessoa_id)       as pessoas,
  min(buscado_em)                 as primeira_busca,
  max(buscado_em)                 as ultima_busca
from analytics.fato_temas_buscados
group by perfil_comercial, tema;

/** Desempenho de cada trecho: recomendado x aberto. A distância é o insight. */
create or replace view analytics.vw_desempenho_trechos as
select
  t.trecho_id,
  t.video_id,
  t.video_titulo,
  t.inicio_segundos,
  t.temas,
  count(distinct r.recomendacao_id) as vezes_recomendado,
  count(distinct w.visualizacao_id) as vezes_aberto,
  round(
    count(distinct w.visualizacao_id)::numeric
      / nullif(count(distinct r.recomendacao_id), 0), 3
  ) as taxa_abertura,
  avg(r.relevancia) as relevancia_media
from analytics.dim_trechos t
left join analytics.fato_recomendacoes r on r.trecho_id = t.trecho_id
left join analytics.fato_visualizacoes w on w.trecho_id = t.trecho_id
group by t.trecho_id, t.video_id, t.video_titulo, t.inicio_segundos, t.temas;

/** Uma linha por pessoa com o resumo do comportamento dela. */
create or replace view analytics.vw_engajamento_pessoa as
select
  p.pessoa_id,
  p.perfil_comercial,
  p.cadastrado_em,
  p.status_nutricao,
  count(distinct b.busca_id)        as total_buscas,
  count(distinct w.visualizacao_id) as total_trechos_abertos,
  max(b.buscado_em)                 as ultima_busca,
  max(w.aberto_em)                  as ultima_abertura,
  array_agg(distinct tb.tema) filter (where tb.tema is not null) as temas_de_interesse
from analytics.dim_pessoas p
left join analytics.fato_buscas b on b.pessoa_id = p.pessoa_id
left join analytics.fato_visualizacoes w on w.pessoa_id = p.pessoa_id
left join analytics.fato_temas_buscados tb on tb.pessoa_id = p.pessoa_id
group by p.pessoa_id, p.perfil_comercial, p.cadastrado_em, p.status_nutricao;

-- ============================================================
-- PAPEL DE LEITURA DO NEKT
--
-- Só SELECT, só no schema analytics. Sem acesso a public nem a auth,
-- então nem embedding, nem senha, nem token atravessa.
-- A senha é definida fora deste arquivo (ver PROMPT-COWORK-NEKT.md).
-- ============================================================
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'nekt_reader') then
    create role nekt_reader login;
  end if;
end $$;

revoke all on schema public from nekt_reader;
grant usage on schema analytics to nekt_reader;
grant select on all tables in schema analytics to nekt_reader;
alter default privileges in schema analytics grant select on tables to nekt_reader;

-- as views são SECURITY INVOKER por padrão: como nekt_reader não tem acesso
-- às tabelas de public, elas precisam rodar com o dono. Sem isso o Nekt
-- autentica mas não lê nada.
do $$
declare v record;
begin
  for v in select table_name from information_schema.views where table_schema = 'analytics'
  loop
    execute format('alter view analytics.%I set (security_invoker = false)', v.table_name);
  end loop;
end $$;
