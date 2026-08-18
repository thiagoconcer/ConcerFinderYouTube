-- ---------------------------------------------------------------------------
-- Cliques no CTA de parceiro.
--
-- A UTM do link diz ao parceiro que o lead veio do ConcerFinder, mas não diz
-- NADA para o nosso lado: não sabemos quem clicou, depois de qual dor, nem se
-- o CTA funciona melhor para dono ou para gestor. Sem isso, a ideia discutida
-- na call de 18/08 (vender espaço para outros parceiros, porque "são leads
-- qualificados") não teria como ser provada com número.
--
-- Aqui é mais simples do que num blog justamente porque a pessoa está logada:
-- o clique já vem com nome, cargo e a busca que ela acabou de fazer.
--
-- `destino` e `local` são texto livre de propósito. Amanhã entram banner
-- lateral e barra fixa, que foram as outras duas ideias da call, e nenhuma
-- delas deve exigir migration nova.
-- ---------------------------------------------------------------------------

create table if not exists public.cta_clicks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  search_id uuid references public.searches (id) on delete set null,
  destino text not null,
  local text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_cta_clicks_profile_id on public.cta_clicks (profile_id);
create index if not exists idx_cta_clicks_created_at on public.cta_clicks (created_at);

comment on table public.cta_clicks is
  'Cliques em CTA de parceiro dentro da plataforma. destino = parceiro (viverdeia), '
  'local = onde estava o CTA (plano-de-acao, banner-lateral, barra-topo).';

alter table public.cta_clicks enable row level security;

-- A pessoa registra o próprio clique e não lê nada; staff lê tudo. Sem policy
-- de UPDATE e DELETE: log não se corrige, e clique apagado é número que mente.
create policy "cta_clicks_insert_self" on public.cta_clicks
  for insert to authenticated
  with check (profile_id = auth.uid());

create policy "cta_clicks_select_staff" on public.cta_clicks
  for select to authenticated
  using (public.is_concer_staff());

-- Data lake: a stream está em extract_all_fields, a tabela entra sozinha.
create or replace view analytics.fato_cliques_cta as
  select
    c.id as clique_id,
    c.profile_id as pessoa_id,
    c.search_id as busca_id,
    c.destino,
    c.local,
    c.created_at as clicado_em,
    p.commercial_role as perfil_comercial,
    p.cargo,
    s.query_text as dor_buscada
  from public.cta_clicks c
  join public.profiles p on p.id = c.profile_id
  left join public.searches s on s.id = c.search_id;

grant select on analytics.fato_cliques_cta to nekt_reader;
