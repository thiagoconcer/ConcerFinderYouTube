-- ============================================================
-- ConcerFinder — RPCs de leitura das telas /video/:id e /busca/historico
--
-- Motivo de existirem: `video_segments` não tem policy para o frontend
-- (docs/ESTRUTURA.md seção 2 e DE-PARA: "nenhuma página lê direto, acesso
-- apenas via RPC"). Estas duas funções são SECURITY DEFINER e só devolvem
-- segmentos que JÁ apareceram numa busca do próprio usuário, ou seja, dados
-- que ele já viu. Staff enxerga o mesmo por is_concer_staff().
-- Rodar depois de db/rpcs.sql. Idempotente.
-- ============================================================

-- ============================================================
-- get_search_results(search_id)
-- Reabre os resultados de uma busca anterior (/busca/historico).
-- ============================================================
create or replace function public.get_search_results(p_search_id uuid)
returns table (
  search_id uuid,
  query_text text,
  detected_topics text[],
  action_plan text,
  searched_at timestamptz,
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
begin
  if uid is null then
    raise exception 'É preciso estar autenticado.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.searches s
    where s.id = p_search_id
      and (s.profile_id = uid or public.is_concer_staff())
  ) then
    raise exception 'Busca não encontrada.' using errcode = '42501';
  end if;

  return query
  select
    s.id, s.query_text, s.detected_topics, s.action_plan, s.created_at,
    v.id, v.youtube_video_id, v.title, v.thumbnail_url,
    seg.id, seg.segment_text, r.start_seconds, seg.end_seconds,
    r.similarity_score, r.rank_position
  from public.searches s
  join public.search_results r on r.search_id = s.id
  join public.videos v on v.id = r.video_id
  join public.video_segments seg on seg.id = r.segment_id
  where s.id = p_search_id
  order by r.rank_position;
end;
$$;

revoke all on function public.get_search_results(uuid) from public, anon;
grant execute on function public.get_search_results(uuid) to authenticated;

-- ============================================================
-- get_video_detail(video_id)
-- Alimenta /video/:id: metadados do vídeo mais os trechos que o próprio
-- usuário já recuperou em buscas dele para aquele vídeo.
-- ============================================================
create or replace function public.get_video_detail(p_video_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v record;
  trechos jsonb;
begin
  if uid is null then
    raise exception 'É preciso estar autenticado.' using errcode = '42501';
  end if;

  select id, youtube_video_id, title, description, thumbnail_url,
         duration_seconds, published_at, transcription_status
  into v
  from public.videos
  where id = p_video_id;

  if not found then
    raise exception 'Vídeo não encontrado.' using errcode = 'P0002';
  end if;

  -- trechos que este usuário já viu em buscas próprias (ou tudo, se for staff)
  select coalesce(jsonb_agg(t order by t->>'start_seconds'), '[]'::jsonb)
  into trechos
  from (
    select distinct on (seg.id) jsonb_build_object(
      'segment_id', seg.id,
      'segment_text', seg.segment_text,
      'start_seconds', seg.start_seconds,
      'end_seconds', seg.end_seconds,
      'topic_tags', seg.topic_tags,
      'similarity_score', r.similarity_score
    ) as t
    from public.video_segments seg
    join public.search_results r on r.segment_id = seg.id
    join public.searches s on s.id = r.search_id
    where seg.video_id = p_video_id
      and (s.profile_id = uid or public.is_concer_staff())
    order by seg.id, r.similarity_score desc
  ) x;

  return jsonb_build_object(
    'video', jsonb_build_object(
      'id', v.id,
      'youtube_video_id', v.youtube_video_id,
      'title', v.title,
      'description', v.description,
      'thumbnail_url', v.thumbnail_url,
      'duration_seconds', v.duration_seconds,
      'published_at', v.published_at,
      'transcription_status', v.transcription_status
    ),
    'segments', trechos
  );
end;
$$;

revoke all on function public.get_video_detail(uuid) from public, anon;
grant execute on function public.get_video_detail(uuid) to authenticated;
