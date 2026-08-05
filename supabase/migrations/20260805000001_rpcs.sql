-- ============================================================
-- ConcerFinder — RPCs de busca e audiência
-- Complementa db/schemas.sql (que cria tabelas, RLS e triggers).
-- Rodar DEPOIS de db/schemas.sql. Idempotente (create or replace).
-- ============================================================

-- ============================================================
-- RPC: search_videos
-- Núcleo do produto. Busca por similaridade de cosseno em
-- video_segments, persiste a busca e as recomendações e devolve
-- a minutagem exata de cada insight.
--
-- SECURITY DEFINER: é a ÚNICA via de acesso a video_segments,
-- que não tem policy para o frontend (docs/ESTRUTURA.md seção 2).
--
-- Assinatura da doc: search_videos(query_embedding, match_count).
-- query_text e detected_topics entram como parâmetros extras
-- porque a própria doc exige persistir searches.query_text e
-- searches.detected_topics dentro desta função. [Extensão do doc]
-- ============================================================
create or replace function public.search_videos(
  query_embedding vector(1536),
  match_count int default 5,
  query_text text default '',
  detected_topics text[] default null,
  min_similarity float default 0.15
)
returns table (
  search_id uuid,
  video_id uuid,
  youtube_video_id text,
  title text,
  thumbnail_url text,
  segment_id uuid,
  segment_text text,
  start_seconds int,
  end_seconds int,
  similarity_score float,
  rank_position int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_search_id uuid;
begin
  -- Regra crítica do PROCESSO: visitante sem cadastro não vê recomendação.
  if uid is null then
    raise exception 'É preciso estar autenticado para buscar insights.'
      using errcode = '42501';
  end if;

  if query_embedding is null then
    raise exception 'query_embedding é obrigatório.' using errcode = '22023';
  end if;

  -- match_count entre 1 e 20 (protege contra abuso e custo de LLM depois)
  match_count := least(greatest(coalesce(match_count, 5), 1), 20);

  -- Registra a dor buscada e associa ao perfil (alimenta a segmentação
  -- de audiência: "cada dor pesquisada é registrada e associada ao perfil").
  insert into public.searches (profile_id, query_text, detected_topics)
  values (uid, coalesce(nullif(query_text, ''), '(sem texto)'), detected_topics)
  returning id into new_search_id;

  return query
  with ranked as (
    select
      v.id            as video_id,
      v.youtube_video_id,
      v.title,
      v.thumbnail_url,
      s.id            as segment_id,
      s.segment_text,
      s.start_seconds,
      s.end_seconds,
      -- pgvector: <=> é distância de cosseno (0 = idêntico)
      (1 - (s.embedding <=> query_embedding))::float as similarity_score
    from public.video_segments s
    join public.videos v on v.id = s.video_id
    where s.embedding is not null
      and v.transcription_status = 'indexed'   -- só vídeo indexado participa da busca
    order by s.embedding <=> query_embedding
    limit match_count
  ),
  filtrado as (
    select r.*, row_number() over (order by r.similarity_score desc)::int as rank_position
    from ranked r
    where r.similarity_score >= min_similarity
  ),
  persistido as (
    insert into public.search_results
      (search_id, video_id, segment_id, start_seconds, similarity_score, rank_position)
    select new_search_id, f.video_id, f.segment_id, f.start_seconds, f.similarity_score, f.rank_position
    from filtrado f
    returning 1
  )
  select
    new_search_id,
    f.video_id,
    f.youtube_video_id,
    f.title,
    f.thumbnail_url,
    f.segment_id,
    f.segment_text,
    f.start_seconds,
    f.end_seconds,
    f.similarity_score,
    f.rank_position
  from filtrado f
  order by f.rank_position;
end;
$$;

revoke all on function public.search_videos(vector, int, text, text[], float) from public, anon;
grant execute on function public.search_videos(vector, int, text, text[], float) to authenticated;

-- ============================================================
-- RPC: get_audience_insights
-- Consolida dores buscadas × perfil comercial para o painel
-- /admin/audiencia. Staff-only, somente agregação.
-- ============================================================
create or replace function public.get_audience_insights(
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

  with busca as (
    select s.id, s.detected_topics, s.created_at, p.commercial_role
    from public.searches s
    join public.profiles p on p.id = s.profile_id
    where s.created_at between inicio and fim
      and (filter_commercial_role is null or p.commercial_role = filter_commercial_role)
  ),
  tema as (
    select unnest(coalesce(b.detected_topics, array[]::text[])) as topico, b.commercial_role
    from busca b
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('de', inicio, 'ate', fim),

    'totais', (
      select jsonb_build_object(
        'leads', (select count(*) from public.leads),
        'perfis', (select count(*) from public.profiles),
        'buscas', (select count(*) from busca),
        'videos_indexados', (select count(*) from public.videos where transcription_status = 'indexed')
      )
    ),

    -- distribuição de leads por perfil comercial
    'leads_por_perfil', coalesce((
      select jsonb_agg(x order by x->>'commercial_role')
      from (
        select jsonb_build_object('commercial_role', commercial_role, 'total', count(*)) as x
        from public.leads group by commercial_role
      ) t
    ), '[]'::jsonb),

    -- saúde da régua de nutrição
    'nutricao', coalesce((
      select jsonb_object_agg(nurture_status, total)
      from (select nurture_status, count(*) as total from public.leads group by nurture_status) t
    ), '{}'::jsonb),

    -- ranking de dores mais buscadas
    'temas', coalesce((
      select jsonb_agg(x order by (x->>'total')::int desc)
      from (
        select jsonb_build_object('topico', topico, 'total', count(*)) as x
        from tema where topico is not null and topico <> ''
        group by topico order by count(*) desc limit 25
      ) t
    ), '[]'::jsonb),

    -- cruzamento tema × perfil comercial (base da segmentação para parceiros)
    'temas_por_perfil', coalesce((
      select jsonb_agg(x)
      from (
        select jsonb_build_object(
          'topico', topico,
          'commercial_role', commercial_role,
          'total', count(*)
        ) as x
        from tema where topico is not null and topico <> ''
        group by topico, commercial_role
        order by count(*) desc limit 60
      ) t
    ), '[]'::jsonb),

    -- buscas que não acharam nada: insumo de pauta de conteúdo
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
$$;

revoke all on function public.get_audience_insights(timestamptz, timestamptz, text) from public, anon;
grant execute on function public.get_audience_insights(timestamptz, timestamptz, text) to authenticated;

-- ============================================================
-- RPC: get_content_dashboard
-- Contadores da esteira de ingestão para /admin/conteudo.
-- Staff-only. [Extensão do doc: agregação que a página pede em
-- "painel de status geral da base"]
-- ============================================================
create or replace function public.get_content_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_concer_staff() then
    raise exception 'Acesso restrito à equipe Concer.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'videos', coalesce((
      select jsonb_object_agg(transcription_status, total)
      from (select transcription_status, count(*) as total from public.videos group by transcription_status) t
    ), '{}'::jsonb),
    'total_videos', (select count(*) from public.videos),
    'total_segmentos', (select count(*) from public.video_segments),
    'segmentos_com_embedding', (select count(*) from public.video_segments where embedding is not null),
    'ultima_ingestao', (
      select jsonb_build_object('run_type', run_type, 'status', status, 'started_at', started_at, 'finished_at', finished_at)
      from public.ingestion_runs order by started_at desc limit 1
    )
  );
end;
$$;

revoke all on function public.get_content_dashboard() from public, anon;
grant execute on function public.get_content_dashboard() to authenticated;
