-- ============================================================
-- ConcerFinder — Schema Supabase (PostgreSQL)
-- ============================================================

-- Extensões necessárias
create extension if not exists "pgcrypto";
create extension if not exists vector;

-- ============================================================
-- Function + trigger reutilizável de updated_at
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- Helper de RLS: identifica staff Concer
-- ============================================================
create or replace function public.is_concer_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('content_admin', 'audience_manager')
  );
$$;

-- ============================================================
-- TABELA: profiles
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null,
  whatsapp text not null,
  commercial_role text not null check (commercial_role in ('vendedor','gestor_comercial','dono_empresa')),
  role text not null default 'user' check (role in ('user','content_admin','audience_manager')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_profiles_commercial_role on public.profiles (commercial_role);
create index idx_profiles_role on public.profiles (role);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "profiles_select_own_or_staff" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_concer_staff());

-- INSERT feito pelo trigger handle_new_user (contexto do signup)
create policy "profiles_insert_self" on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

create policy "profiles_update_own_or_staff" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_concer_staff())
  with check (id = auth.uid() or public.is_concer_staff());

-- DELETE: ninguém pelo frontend (somente service_role, que ignora RLS)

-- ============================================================
-- TABELA: leads
-- ============================================================
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  full_name text not null,
  email text not null,
  whatsapp text not null,
  commercial_role text not null,
  nurture_status text not null default 'pending' check (nurture_status in ('pending','sent','failed')),
  nurture_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_leads_profile_id on public.leads (profile_id);
create index idx_leads_nurture_status on public.leads (nurture_status);
create index idx_leads_commercial_role on public.leads (commercial_role);

create trigger trg_leads_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

alter table public.leads enable row level security;

-- SELECT apenas staff; INSERT/UPDATE apenas service_role (Edge Function)
create policy "leads_select_staff" on public.leads
  for select to authenticated
  using (public.is_concer_staff());

-- INSERT e UPDATE ficam sem policy para authenticated (só service_role)
-- DELETE: ninguém

-- ============================================================
-- TABELA: videos
-- ============================================================
create table public.videos (
  id uuid primary key default gen_random_uuid(),
  youtube_video_id text not null unique,
  title text not null,
  description text,
  thumbnail_url text,
  duration_seconds int,
  published_at timestamptz,
  transcription_status text not null default 'pending' check (transcription_status in ('pending','transcribing','transcribed','indexed','failed')),
  indexed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_videos_transcription_status on public.videos (transcription_status);
create index idx_videos_published_at on public.videos (published_at);

create trigger trg_videos_updated_at
  before update on public.videos
  for each row execute function public.set_updated_at();

alter table public.videos enable row level security;

-- SELECT: qualquer usuário autenticado; INSERT/DELETE: service_role
create policy "videos_select_authenticated" on public.videos
  for select to authenticated
  using (true);

-- UPDATE: staff pode marcar revisão; demais alterações via service_role
create policy "videos_update_staff" on public.videos
  for update to authenticated
  using (public.is_concer_staff())
  with check (public.is_concer_staff());

-- ============================================================
-- TABELA: video_segments
-- ============================================================
create table public.video_segments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos (id) on delete cascade,
  segment_text text not null,
  start_seconds int not null,
  end_seconds int not null,
  topic_tags text[],
  embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_video_segments_video_id on public.video_segments (video_id);
create index idx_video_segments_embedding on public.video_segments
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create trigger trg_video_segments_updated_at
  before update on public.video_segments
  for each row execute function public.set_updated_at();

alter table public.video_segments enable row level security;

-- Sem policy para authenticated: acesso apenas via RPC search_videos (SECURITY DEFINER)
-- e via service_role na ingestão. RLS ligado bloqueia acesso direto do frontend.

-- ============================================================
-- TABELA: searches
-- ============================================================
create table public.searches (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  query_text text not null,
  detected_topics text[],
  action_plan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_searches_profile_id on public.searches (profile_id);
create index idx_searches_created_at on public.searches (created_at);
create index idx_searches_detected_topics on public.searches using gin (detected_topics);

create trigger trg_searches_updated_at
  before update on public.searches
  for each row execute function public.set_updated_at();

alter table public.searches enable row level security;

create policy "searches_select_own_or_staff" on public.searches
  for select to authenticated
  using (profile_id = auth.uid() or public.is_concer_staff());

create policy "searches_insert_own" on public.searches
  for insert to authenticated
  with check (profile_id = auth.uid());

-- UPDATE/DELETE: ninguém pelo frontend

-- ============================================================
-- TABELA: search_results
-- ============================================================
create table public.search_results (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.searches (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  segment_id uuid not null references public.video_segments (id) on delete cascade,
  start_seconds int not null,
  similarity_score float not null,
  rank_position int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_search_results_search_id on public.search_results (search_id);
create index idx_search_results_video_id on public.search_results (video_id);
create index idx_search_results_segment_id on public.search_results (segment_id);

create trigger trg_search_results_updated_at
  before update on public.search_results
  for each row execute function public.set_updated_at();

alter table public.search_results enable row level security;

-- SELECT: dono da busca associada ou staff; INSERT via RPC/service_role
create policy "search_results_select_own_or_staff" on public.search_results
  for select to authenticated
  using (
    public.is_concer_staff()
    or exists (
      select 1 from public.searches s
      where s.id = search_results.search_id
        and s.profile_id = auth.uid()
    )
  );

-- INSERT/UPDATE/DELETE: apenas service_role/RPC

-- ============================================================
-- TABELA: ingestion_runs
-- ============================================================
create table public.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null check (run_type in ('scrape','transcribe','index')),
  status text not null default 'running' check (status in ('running','completed','failed')),
  videos_processed int not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_ingestion_runs_status on public.ingestion_runs (status);
create index idx_ingestion_runs_started_at on public.ingestion_runs (started_at);

create trigger trg_ingestion_runs_updated_at
  before update on public.ingestion_runs
  for each row execute function public.set_updated_at();

alter table public.ingestion_runs enable row level security;

-- SELECT: staff; INSERT/UPDATE: service_role (Edge Functions da ingestão)
create policy "ingestion_runs_select_staff" on public.ingestion_runs
  for select to authenticated
  using (public.is_concer_staff());

-- ============================================================
-- TRIGGER: cria profile no signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, whatsapp, commercial_role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'whatsapp', ''),
    coalesce(new.raw_user_meta_data->>'commercial_role', 'vendedor')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
