-- ---------------------------------------------------------------------------
-- Engajamento por e-mail: o que a régua provoca, dentro do painel.
--
-- O QUE FALTAVA. O painel media bem o que acontece DENTRO do produto (busca,
-- trecho aberto, clique no convite do parceiro) e não sabia nada do que a régua
-- provoca. A lista de leads mostrava a etapa em que a pessoa está, lida ao vivo
-- do ActiveCampaign, e etapa é o que foi ENVIADO, não o que foi lido.
--
-- Isso ficou caro em 20/08, quando a régua de gestor e dono passou a levar o
-- botão do Viver de IA: quem clica nesse botão pelo e-mail não passa pelo app,
-- então o interesse no parceiro virava invisível justo no canal que cresce.
--
-- O QUE A API DO ACTIVECAMPAIGN ENTREGA, conferido em 21/08:
--  - `logs?filters[campaignid]=`  -> envio por contato, com data
--  - `links/{id}/linkData`        -> clique por contato, com link e data
--  - campos do contato            -> último open e último clique, agregados da
--                                    conta inteira, não por campanha
--  - o objeto da campanha         -> totais de abertura e clique
-- Abertura individual por campanha NÃO existe na API. Por isso a tabela guarda
-- evento de envio e de clique, que são exatos, e o open entra só como agregado
-- por pessoa, com o nome dizendo o que é.
--
-- POR QUE GRAVAR E NÃO CONSULTAR AO VIVO. A lista de leads já consulta o AC a
-- cada carga para saber a etapa, e isso custa segundos e depende de um terceiro
-- estar de pé. Agregação de painel não pode depender disso: os eventos vêm por
-- sincronização e o painel lê do nosso banco.
-- ---------------------------------------------------------------------------

create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  -- null quando o contato existe no ActiveCampaign mas não tem conta no
  -- produto (base antiga do Thiago Concer, importada antes do ConcerFinder)
  profile_id uuid references public.profiles (id) on delete cascade,
  ac_contact_id text not null,
  email text not null,
  campaign_id text not null,
  campaign_name text,
  message_id text,
  tipo text not null check (tipo in ('enviado', 'clique')),
  link_url text,
  ocorrido_em timestamptz not null,
  created_at timestamptz not null default now()
);

comment on table public.email_events is
  'Envios e cliques das campanhas do ConcerFinder no ActiveCampaign, sincronizados por sync-email-events.';

-- Idempotência da sincronização: o mesmo envio ou clique pode voltar em toda
-- rodada, e sem esta chave a tabela cresceria com repetição a cada execução.
create unique index if not exists idx_email_events_unico
  on public.email_events (ac_contact_id, campaign_id, tipo, coalesce(link_url, ''), ocorrido_em);

create index if not exists idx_email_events_profile on public.email_events (profile_id);
create index if not exists idx_email_events_ocorrido on public.email_events (ocorrido_em);
create index if not exists idx_email_events_campanha on public.email_events (campaign_id);

-- ---------------------------------------------------------------------------
-- Agregados por contato. Vêm prontos do ActiveCampaign e valem a coluna porque
-- respondem "essa pessoa lê e-mail?" sem varrer eventos. `enviados_na_conta` é
-- da CONTA INTEIRA (todas as campanhas do Thiago Concer, desde sempre), e o
-- nome diz isso para ninguém confundir com a régua do ConcerFinder.
-- ---------------------------------------------------------------------------

create table if not exists public.email_contatos (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  ac_contact_id text not null,
  enviados_na_conta int not null default 0,
  ultimo_open timestamptz,
  ultimo_clique timestamptz,
  bounce boolean not null default false,
  atualizado_em timestamptz not null default now()
);

alter table public.email_events enable row level security;
alter table public.email_contatos enable row level security;

drop policy if exists "email_events staff le" on public.email_events;
create policy "email_events staff le" on public.email_events
  for select using (public.is_concer_staff());

drop policy if exists "email_contatos staff le" on public.email_contatos;
create policy "email_contatos staff le" on public.email_contatos
  for select using (public.is_concer_staff());

-- ---------------------------------------------------------------------------
-- get_email_insights: a régua vista pelo lado de quem recebe.
--
-- Três leituras, nesta ordem:
--
-- 1. FUNIL POR E-MAIL. Para cada e-mail da régua: quantos receberam e quantos
--    clicaram. Clique é o sinal honesto aqui, porque abertura por campanha a
--    API não dá e, mesmo quando dá, o Apple Mail infla o número abrindo por
--    conta própria.
-- 2. O CONVITE DO PARCEIRO SOMADO. Antes deste relatório, clique no convite só
--    contava se acontecesse dentro do app (cta_clicks). Agora as duas portas
--    aparecem juntas, com a origem ao lado, e a mesma pessoa não é contada duas
--    vezes: a conta é de PESSOAS que levantaram a mão, não de cliques.
-- 3. QUEM LÊ E NÃO USA. Pessoa que clica no e-mail e não busca é o caso mais
--    acionável da base: a mensagem funcionou e o produto não recebeu a visita.
-- ---------------------------------------------------------------------------

create or replace function public.get_email_insights(
  from_date timestamptz default null,
  to_date timestamptz default null,
  filter_commercial_role text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  resultado jsonb;
  inicio timestamptz := coalesce(from_date, now() - interval '90 days');
  fim timestamptz := coalesce(to_date, now());
begin
  if not public.is_concer_staff() then
    raise exception 'Acesso restrito à equipe Concer.' using errcode = '42501';
  end if;

  with evento as (
    select e.*, p.commercial_role
    from public.email_events e
    join public.profiles p on p.id = e.profile_id
    where e.ocorrido_em between inicio and fim
      and not p.is_internal
      and (filter_commercial_role is null or p.commercial_role = filter_commercial_role)
  ),
  por_campanha as (
    select
      campaign_id,
      max(campaign_name) as nome,
      count(distinct profile_id) filter (where tipo = 'enviado') as receberam,
      count(distinct profile_id) filter (where tipo = 'clique') as clicaram,
      min(ocorrido_em) filter (where tipo = 'enviado') as primeiro_envio
    from evento group by campaign_id
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('de', inicio, 'ate', fim),

    'totais', (
      select jsonb_build_object(
        'pessoas_que_receberam', count(distinct profile_id) filter (where tipo = 'enviado'),
        'pessoas_que_clicaram', count(distinct profile_id) filter (where tipo = 'clique'),
        'envios', count(*) filter (where tipo = 'enviado'),
        'cliques', count(*) filter (where tipo = 'clique')
      ) from evento
    ),

    'por_email', coalesce((
      select jsonb_agg(jsonb_build_object(
        'campanha', nome, 'campaign_id', campaign_id,
        'receberam', receberam, 'clicaram', clicaram,
        'taxa', case when receberam > 0 then round(clicaram::numeric * 100 / receberam, 1) end
      ) order by nome)
      from por_campanha
    ), '[]'::jsonb),

    -- O convite do parceiro pelas duas portas, contando PESSOAS e não cliques.
    'convite_parceiro', (
      select jsonb_build_object(
        'pelo_email', (
          select count(distinct profile_id) from evento
          where tipo = 'clique' and link_url like '%viverdeia%'
        ),
        'pelo_app', (
          select count(distinct c.profile_id) from public.cta_clicks c
          join public.profiles p on p.id = c.profile_id
          where c.created_at between inicio and fim and not p.is_internal
            and (filter_commercial_role is null or p.commercial_role = filter_commercial_role)
        ),
        'pessoas_no_total', (
          select count(*) from (
            select profile_id from evento where tipo = 'clique' and link_url like '%viverdeia%'
            union
            select c.profile_id from public.cta_clicks c
            join public.profiles p on p.id = c.profile_id
            where c.created_at between inicio and fim and not p.is_internal
              and (filter_commercial_role is null or p.commercial_role = filter_commercial_role)
          ) t
        )
      )
    ),

    /*
      Clicou no e-mail e nunca buscou. É a lista mais acionável do painel: a
      mensagem funcionou, a pessoa levantou a mão, e o produto não recebeu a
      visita. Vale ligação, não outro e-mail.
    */
    'clicou_e_nao_buscou', coalesce((
      select jsonb_agg(jsonb_build_object(
        'profile_id', p.id, 'nome', p.full_name, 'email', p.email,
        'perfil', p.commercial_role, 'ultimo_clique', max(e.ocorrido_em)
      ) order by max(e.ocorrido_em) desc)
      from evento e join public.profiles p on p.id = e.profile_id
      where e.tipo = 'clique'
        and not exists (select 1 from public.searches s where s.profile_id = p.id)
      group by p.id, p.full_name, p.email, p.commercial_role
    ), '[]'::jsonb),

    'ultimos_cliques', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nome', p.full_name, 'profile_id', p.id, 'campanha', e.campaign_name,
        'link', e.link_url, 'em', e.ocorrido_em
      ) order by e.ocorrido_em desc)
      from (select * from evento where tipo = 'clique' order by ocorrido_em desc limit 15) e
      join public.profiles p on p.id = e.profile_id
    ), '[]'::jsonb),

    -- Agregado do contato no ActiveCampaign: responde "essa pessoa lê e-mail?"
    'leitores', (
      select jsonb_build_object(
        'com_open_registrado', count(*) filter (where c.ultimo_open is not null),
        'com_clique_registrado', count(*) filter (where c.ultimo_clique is not null),
        'com_bounce', count(*) filter (where c.bounce)
      )
      from public.email_contatos c
      join public.profiles p on p.id = c.profile_id
      where not p.is_internal
        and (filter_commercial_role is null or p.commercial_role = filter_commercial_role)
    )
  ) into resultado;

  return resultado;
end;
$function$;

revoke all on function public.get_email_insights(timestamptz, timestamptz, text) from public, anon;
grant execute on function public.get_email_insights(timestamptz, timestamptz, text) to authenticated;
