-- ============================================================
-- CARGO: granularidade real do cadastro
--
-- Antes o cadastro perguntava só o perfil comercial (3 opções), que é o que
-- move a régua de nutrição. Agora ele pergunta o CARGO (9 opções), e o perfil
-- passa a ser derivado.
--
-- Por que os dois convivem:
--   . `cargo` é para inteligência de audiência. São exatamente os 9 rótulos do
--     campo "Cargo Newsletter" (id 35) que a Concer já usa no ActiveCampaign,
--     então o lead do ConcerFinder fica comparável com o resto da base.
--   . `commercial_role` é o gatilho da régua. Nove opções virariam nove
--     automações para manter, e o conteúdo dos e-mails não muda entre um
--     Coordenador e um Supervisor.
--
-- O mapeamento mora AQUI, em uma função só. Frontend e Edge Functions
-- derivam a partir do banco, nunca reimplementam a regra.
-- ============================================================

-- ------------------------------------------------------------
-- 1. A regra de negócio, em um lugar só
-- ------------------------------------------------------------
create or replace function public.perfil_do_cargo(p_cargo text)
returns text
language sql
immutable
as $$
  select case p_cargo
    -- quem responde pelo negócio: conteúdo de visão, previsibilidade, sistema
    when 'fundador'        then 'dono_empresa'
    when 'socio'           then 'dono_empresa'
    when 'presidente_ceo'  then 'dono_empresa'
    when 'vice_presidente' then 'dono_empresa'
    -- quem responde por um time: conteúdo de gestão, reunião, role play
    when 'diretor'         then 'gestor_comercial'
    when 'coordenador'     then 'gestor_comercial'
    when 'supervisor'      then 'gestor_comercial'
    when 'gerente'         then 'gestor_comercial'
    -- quem vende
    when 'vendedor'        then 'vendedor'
  end;
$$;

comment on function public.perfil_do_cargo(text) is
  'Traduz um dos 9 cargos no perfil comercial que move a régua de nutrição. '
  'Devolve NULL para cargo desconhecido, o que serve de validação.';

-- ------------------------------------------------------------
-- 2. Colunas
-- ------------------------------------------------------------
alter table public.profiles add column if not exists cargo text;
alter table public.leads    add column if not exists cargo text;

-- O check usa a própria função: cargo válido é aquele que a regra sabe traduzir.
-- Assim não existe uma segunda lista para esquecer de atualizar.
alter table public.profiles drop constraint if exists profiles_cargo_check;
alter table public.profiles add constraint profiles_cargo_check
  check (cargo is null or public.perfil_do_cargo(cargo) is not null);

alter table public.leads drop constraint if exists leads_cargo_check;
alter table public.leads add constraint leads_cargo_check
  check (cargo is null or public.perfil_do_cargo(cargo) is not null);

create index if not exists idx_profiles_cargo on public.profiles (cargo);
create index if not exists idx_leads_cargo    on public.leads (cargo);

comment on column public.profiles.cargo is
  'Cargo declarado no cadastro. Mesmos 9 rótulos do campo Cargo Newsletter do ActiveCampaign.';

-- ------------------------------------------------------------
-- 3. Coerência garantida no banco, não na aplicação
--
-- Se alguém gravar cargo por qualquer caminho (frontend, Edge Function, SQL
-- na mão), o perfil comercial se ajusta sozinho. Sem isso, um dia teríamos um
-- 'vendedor' recebendo a régua de dono porque uma rota esqueceu de derivar.
-- ------------------------------------------------------------
create or replace function public.deriva_perfil_do_cargo()
returns trigger
language plpgsql
as $$
declare
  v_perfil text;
begin
  if new.cargo is not null then
    v_perfil := public.perfil_do_cargo(new.cargo);
    -- Sem isto o cargo desconhecido zeraria commercial_role e o erro que
    -- chegaria à aplicação seria "null value violates not-null constraint",
    -- que não diz nada a quem está preenchendo o formulário. O trigger roda
    -- antes do check da coluna, então a mensagem boa precisa vir daqui.
    if v_perfil is null then
      raise exception 'Cargo inválido: %', new.cargo using errcode = '23514';
    end if;
    new.commercial_role := v_perfil;
  end if;
  return new;
end;
$$;

drop trigger if exists deriva_perfil_do_cargo_profiles on public.profiles;
create trigger deriva_perfil_do_cargo_profiles
  before insert or update of cargo on public.profiles
  for each row execute function public.deriva_perfil_do_cargo();

drop trigger if exists deriva_perfil_do_cargo_leads on public.leads;
create trigger deriva_perfil_do_cargo_leads
  before insert or update of cargo on public.leads
  for each row execute function public.deriva_perfil_do_cargo();

-- ------------------------------------------------------------
-- 4. Signup passa a mandar cargo
--
-- Cargo inválido no metadata NÃO pode derrubar o cadastro: cai para null e a
-- pessoa entra mesmo assim. Perder um campo é ruim, perder o lead é pior.
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cargo text := nullif(new.raw_user_meta_data->>'cargo', '');
begin
  if v_cargo is not null and public.perfil_do_cargo(v_cargo) is null then
    v_cargo := null;
  end if;

  insert into public.profiles (id, full_name, email, whatsapp, commercial_role, cargo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'whatsapp', ''),
    coalesce(
      public.perfil_do_cargo(v_cargo),
      new.raw_user_meta_data->>'commercial_role',
      'vendedor'
    ),
    v_cargo
  );
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 5. Backfill do que dá para saber
--
-- 'vendedor' é o único perfil que corresponde a um cargo único, então é o
-- único que pode ser preenchido sem inventar. Quem é 'gestor_comercial' pode
-- ser Diretor, Coordenador, Supervisor ou Gerente, e chutar um deles sujaria
-- justamente o dado que este campo veio trazer. Esses ficam null, e o painel
-- mostra "não informado".
-- ------------------------------------------------------------
update public.profiles set cargo = 'vendedor'
  where cargo is null and commercial_role = 'vendedor';
update public.leads set cargo = 'vendedor'
  where cargo is null and commercial_role = 'vendedor';

-- ------------------------------------------------------------
-- 6. O cargo chega ao data lake
--
-- Coluna acrescentada no FIM de cada view: as 11 streams do Nekt estão em
-- extract_all_fields = true, então a coluna nova entra sozinha na próxima
-- sincronização, sem precisar mexer na fonte.
--
-- Os agregados (vw_dores_por_perfil) ficam como estão de propósito: mudar o
-- group by deles mudaria o contrato de quem já consome. Quem quiser o corte
-- por cargo agrupa a partir do fato.
-- ------------------------------------------------------------
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
  l.nurture_sent_at   as nutricao_enviada_em,
  p.cargo
from public.profiles p
left join public.leads l on l.profile_id = p.id;

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
  (select count(*) from public.video_views w where w.search_id = s.id)    as trechos_abertos,
  p.cargo
from public.searches s
join public.profiles p on p.id = s.profile_id;

create or replace view analytics.fato_temas_buscados as
select
  s.id              as busca_id,
  s.profile_id      as pessoa_id,
  p.commercial_role as perfil_comercial,
  t.tema,
  s.created_at      as buscado_em,
  p.cargo
from public.searches s
join public.profiles p on p.id = s.profile_id
cross join lateral unnest(coalesce(s.detected_topics, array[]::text[])) as t(tema);

create or replace view analytics.fato_leads as
select
  l.id              as lead_id,
  l.profile_id      as pessoa_id,
  l.commercial_role as perfil_comercial,
  l.nurture_status  as status_nutricao,
  l.nurture_sent_at as nutricao_enviada_em,
  l.created_at      as gerado_em,
  l.cargo
from public.leads l;

grant select on all tables in schema analytics to nekt_reader;

-- ------------------------------------------------------------
-- 7. O corte por cargo no painel
--
-- RPC separada em vez de inchar `get_audience_insights`: o corte por cargo é
-- uma pergunta nova, com uma resposta independente, e a de audiência já tem
-- 150 linhas que não precisam mudar. Registrada no DEPARA.md.
-- ------------------------------------------------------------
create or replace function public.get_cargo_insights(
  from_date timestamptz default null,
  to_date timestamptz default null
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

  with pessoa as (
    select p.id, coalesce(p.cargo, 'nao_informado') as cargo, p.commercial_role
    from public.profiles p
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
$$;

revoke all on function public.get_cargo_insights(timestamptz, timestamptz) from public, anon;
grant execute on function public.get_cargo_insights(timestamptz, timestamptz) to authenticated;
