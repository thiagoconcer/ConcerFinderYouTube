-- ============================================================
-- ConcerFinder — Audiência: visualizações e insights consolidados
--
-- Motivo desta extensão do schema: o painel /admin/audiencia precisa
-- responder "quais trechos são mais assistidos", e esse dado não existia.
-- `search_results` diz o que foi RECOMENDADO; nada dizia o que foi ABERTO.
-- Rodar depois de db/schemas.sql e db/rpcs.sql. Idempotente.
-- ============================================================

-- ============================================================
-- TABELA: video_views
-- Um registro por vez que um usuário abre /video/:id.
-- ============================================================
create table if not exists public.video_views (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  -- de qual trecho veio (nulo quando o usuário abriu o vídeo sem recomendação)
  segment_id uuid references public.video_segments (id) on delete set null,
  -- de qual busca veio (nulo quando chegou por link direto)
  search_id uuid references public.searches (id) on delete set null,
  start_seconds int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_video_views_profile_id on public.video_views (profile_id);
create index if not exists idx_video_views_video_id on public.video_views (video_id);
create index if not exists idx_video_views_segment_id on public.video_views (segment_id);
create index if not exists idx_video_views_created_at on public.video_views (created_at);

drop trigger if exists trg_video_views_updated_at on public.video_views;
create trigger trg_video_views_updated_at
  before update on public.video_views
  for each row execute function public.set_updated_at();

alter table public.video_views enable row level security;

-- SELECT: dono ou staff. INSERT: só o próprio usuário, em nome dele mesmo.
-- UPDATE/DELETE: ninguém pelo frontend (métrica não se edita).
drop policy if exists "video_views_select_own_or_staff" on public.video_views;
create policy "video_views_select_own_or_staff" on public.video_views
  for select to authenticated
  using (profile_id = auth.uid() or public.is_concer_staff());

drop policy if exists "video_views_insert_own" on public.video_views;
create policy "video_views_insert_own" on public.video_views
  for insert to authenticated
  with check (profile_id = auth.uid());

-- ============================================================
-- RPC: get_audience_insights (substitui a versão de db/rpcs.sql)
--
-- Acrescenta ao que já existia:
--   - trechos_mais_recomendados: o que a busca mais devolveu
--   - trechos_mais_assistidos:   o que as pessoas realmente abriram
--   - videos_mais_recomendados:  o mesmo, agregado por vídeo
--   - perfis_por_tema:           quem procura o quê, pronto para a tela
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
    join public.profiles p on p.id = v.profile_id
    where v.created_at between inicio and fim
      and (filter_commercial_role is null or p.commercial_role = filter_commercial_role)
    group by v.segment_id, v.video_id
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('de', inicio, 'ate', fim),

    'totais', (
      select jsonb_build_object(
        'leads', (select count(*) from public.leads),
        'perfis', (select count(*) from public.profiles),
        'buscas', (select count(*) from busca),
        'visualizacoes', (select count(*) from public.video_views where created_at between inicio and fim),
        'videos_indexados', (select count(*) from public.videos where transcription_status = 'indexed')
      )
    ),

    'leads_por_perfil', coalesce((
      select jsonb_agg(x order by x->>'commercial_role')
      from (
        select jsonb_build_object('commercial_role', commercial_role, 'total', count(*)) as x
        from public.leads group by commercial_role
      ) t
    ), '[]'::jsonb),

    'nutricao', coalesce((
      select jsonb_object_agg(nurture_status, total)
      from (select nurture_status, count(*) as total from public.leads group by nurture_status) t
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
$$;

revoke all on function public.get_audience_insights(timestamptz, timestamptz, text) from public, anon;
grant execute on function public.get_audience_insights(timestamptz, timestamptz, text) to authenticated;
