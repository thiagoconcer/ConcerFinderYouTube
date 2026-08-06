-- ============================================================
-- ORIGEM DO LEAD
--
-- Responde "qual canal traz mais gente" com o mesmo rigor que o resto do
-- painel: dado bruto guardado, leitura derivada em cima.
--
-- Por que não bastam os UTM: a maior parte do tráfego vem do próprio canal do
-- YouTube, em link de descrição e comentário fixado, quase sempre sem
-- parâmetro nenhum. Um relatório só de UTM diria "sem origem" para a maioria
-- e esconderia justamente a fonte principal. Por isso guardamos também o
-- referrer e a página de entrada, e a origem é derivada com essa ordem:
--   1. utm_source, quando existe (campanha marcada)
--   2. domínio do referrer (youtube.com, instagram.com, google...)
--   3. 'direto', quando a pessoa digitou ou veio de app sem referrer
--
-- Primeiro toque, não último: o que interessa é o que TROUXE a pessoa. O
-- frontend guarda a primeira origem vista e não sobrescreve depois.
-- ============================================================

alter table public.leads add column if not exists utm_source text;
alter table public.leads add column if not exists utm_medium text;
alter table public.leads add column if not exists utm_campaign text;
alter table public.leads add column if not exists utm_content text;
alter table public.leads add column if not exists utm_term text;
alter table public.leads add column if not exists referrer text;
alter table public.leads add column if not exists landing_page text;

comment on column public.leads.utm_source is
  'Primeiro toque, não último: o que trouxe a pessoa, não a última página antes do cadastro.';
comment on column public.leads.referrer is
  'De onde veio quando não havia UTM. É o que salva o relatório para tráfego orgânico do canal.';

create index if not exists idx_leads_utm_source on public.leads (utm_source);

-- ------------------------------------------------------------
-- A regra de derivação, em um lugar só
--
-- Fica em função e não no relatório porque painel, exportação e data lake
-- precisam contar a mesma história. Duas cópias divergem no primeiro ajuste.
-- ------------------------------------------------------------
create or replace function public.origem_do_lead(p_utm_source text, p_referrer text)
returns text
language sql
immutable
as $$
  select case
    when nullif(btrim(coalesce(p_utm_source, '')), '') is not null then lower(btrim(p_utm_source))
    when nullif(btrim(coalesce(p_referrer, '')), '') is not null then
      -- só o domínio, sem protocolo, sem www e sem caminho: "youtube.com"
      regexp_replace(
        regexp_replace(lower(p_referrer), '^https?://(www\.)?', ''),
        '/.*$', ''
      )
    else 'direto'
  end;
$$;

comment on function public.origem_do_lead(text, text) is
  'UTM quando existe, senão o domínio do referrer, senão "direto". Nunca devolve vazio.';

-- ------------------------------------------------------------
-- Relatório de origem
-- ------------------------------------------------------------
create or replace function public.get_origem_insights(
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

  with lead as (
    select
      l.id,
      l.profile_id,
      public.origem_do_lead(l.utm_source, l.referrer) as origem,
      l.utm_medium,
      l.utm_campaign,
      l.created_at,
      -- Lead que nunca buscou é e-mail, não lead qualificado: a origem só
      -- vale a pena se a gente souber quantos dela chegaram a usar o produto.
      exists (select 1 from public.searches s where s.profile_id = l.profile_id) as ativou
    from public.leads l
    where l.created_at between inicio and fim
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('de', inicio, 'ate', fim),
    'total_leads', (select count(*) from lead),

    'por_origem', coalesce((
      select jsonb_agg(x order by (x->>'leads')::int desc)
      from (
        select jsonb_build_object(
          'origem', origem,
          'leads', count(*),
          'ativaram', count(*) filter (where ativou),
          'taxa_ativacao', round(
            count(*) filter (where ativou)::numeric / nullif(count(*), 0), 3
          )
        ) as x
        from lead group by origem
      ) t
    ), '[]'::jsonb),

    -- Campanha só faz sentido junto do meio: "instagram / stories / lancamento"
    'por_campanha', coalesce((
      select jsonb_agg(x order by (x->>'leads')::int desc)
      from (
        select jsonb_build_object(
          'origem', origem,
          'meio', coalesce(utm_medium, 'sem meio'),
          'campanha', utm_campaign,
          'leads', count(*),
          'ativaram', count(*) filter (where ativou)
        ) as x
        from lead
        where utm_campaign is not null and utm_campaign <> ''
        group by origem, utm_medium, utm_campaign
        limit 30
      ) t
    ), '[]'::jsonb),

    -- Série para ver campanha subindo ou morrendo
    'serie', coalesce((
      select jsonb_agg(jsonb_build_object('dia', d, 'origem', origem, 'leads', n)
                       order by d, origem)
      from (
        select created_at::date as d, origem, count(*) as n
        from lead group by created_at::date, origem
      ) t
    ), '[]'::jsonb)
  ) into resultado;

  return resultado;
end;
$$;

revoke all on function public.get_origem_insights(timestamptz, timestamptz) from public, anon;
grant execute on function public.get_origem_insights(timestamptz, timestamptz) to authenticated;

-- ------------------------------------------------------------
-- O data lake enxerga a origem junto do lead
-- Coluna no FIM da view: as streams do Nekt estão em extract_all_fields,
-- então ela entra sozinha na próxima sincronização.
-- ------------------------------------------------------------
create or replace view analytics.fato_leads as
select
  l.id              as lead_id,
  l.profile_id      as pessoa_id,
  l.commercial_role as perfil_comercial,
  l.nurture_status  as status_nutricao,
  l.nurture_sent_at as nutricao_enviada_em,
  l.created_at      as gerado_em,
  l.cargo,
  public.origem_do_lead(l.utm_source, l.referrer) as origem,
  l.utm_source,
  l.utm_medium,
  l.utm_campaign,
  l.utm_content,
  l.utm_term,
  l.referrer,
  l.landing_page
from public.leads l;

grant select on all tables in schema analytics to nekt_reader;
