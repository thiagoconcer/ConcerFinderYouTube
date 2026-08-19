-- ---------------------------------------------------------------------------
-- Relatório do CTA de parceiro no dashboard.
--
-- A métrica que interessa NÃO é "quantos cliques". Cliques sozinhos sobem
-- quando o tráfego sobe e não dizem nada sobre o CTA funcionar. O que responde
-- é a taxa: de quem VIU o convite, quantos clicaram. É a mesma régua do
-- relatório de origem, onde a coluna que importa é quantos ativaram e não
-- quantos entraram.
--
-- QUEM VIU. Não dá para contar exibição por evento (seria um insert por
-- render, caro e sem valor), então o denominador é derivado: plano de ação que
-- contém a seção de IA, de uma pessoa cujo perfil recebe o botão. É a
-- definição exata de quem teve o convite na frente.
--
-- Isso deixa de fora, de propósito, os planos gerados antes de 18/08/2026, que
-- não têm a seção. O relatório mede o CTA, não a história do produto.
-- ---------------------------------------------------------------------------

create or replace function public.get_cta_insights(
  from_date timestamptz default null,
  to_date timestamptz default null
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

  with exposicao as (
    -- Uma linha por plano que levou o convite. `[[solucao:` é o marcador que o
    -- modelo grava; o título é o fallback para o plano que saiu sem marcador.
    select
      s.id as search_id,
      s.profile_id,
      s.detected_topics,
      s.created_at
    from public.searches s
    join public.profiles p on p.id = s.profile_id
    where s.created_at between inicio and fim
      and s.action_plan is not null
      and (s.action_plan like '%[[solucao:%' or s.action_plan like '%Como a IA acelera%')
      and p.commercial_role in ('dono_empresa', 'gestor_comercial')
  ),
  clique as (
    select c.*, p.commercial_role, p.cargo
    from public.cta_clicks c
    join public.profiles p on p.id = c.profile_id
    where c.created_at between inicio and fim
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('de', inicio, 'ate', fim),

    'planos_com_convite', (select count(*) from exposicao),
    'pessoas_que_viram', (select count(distinct profile_id) from exposicao),
    'cliques', (select count(*) from clique),
    'pessoas_que_clicaram', (select count(distinct profile_id) from clique),
    'taxa', (
      select round(
        (select count(distinct profile_id) from clique)::numeric
          / nullif((select count(distinct profile_id) from exposicao), 0), 3)
    ),

    -- Converte melhor com dono ou com gestor? É o que decide para quem o
    -- lançamento fala primeiro.
    'por_perfil', coalesce((
      select jsonb_agg(x order by (x->>'viram')::int desc)
      from (
        select jsonb_build_object(
          'perfil', p.commercial_role,
          'viram', count(distinct e.profile_id),
          'clicaram', count(distinct c.profile_id)
        ) as x
        from public.profiles p
        left join exposicao e on e.profile_id = p.id
        left join clique c on c.profile_id = p.id
        where p.commercial_role in ('dono_empresa', 'gestor_comercial')
        group by p.commercial_role
        having count(distinct e.profile_id) > 0 or count(distinct c.profile_id) > 0
      ) t
    ), '[]'::jsonb),

    -- Depois de QUAL dor a pessoa clica. Vira pauta de conteúdo e argumento
    -- de campanha, não só número de relatório.
    'por_tema', coalesce((
      select jsonb_agg(x order by (x->>'cliques')::int desc)
      from (
        select jsonb_build_object('tema', tema, 'cliques', count(*)) as x
        from clique c
        join public.searches s on s.id = c.search_id,
             unnest(coalesce(s.detected_topics, array[]::text[])) tema
        group by tema
        limit 15
      ) t
    ), '[]'::jsonb),

    -- Quem clicou, para a equipe poder ligar. A lista é curta de propósito:
    -- painel de dashboard é leitura, o trabalho pessoa a pessoa é em /admin/leads.
    'ultimos', coalesce((
      select jsonb_agg(x order by x->>'clicado_em' desc)
      from (
        select jsonb_build_object(
          'profile_id', c.profile_id,
          'nome', p.full_name,
          'cargo', p.cargo,
          'perfil', c.commercial_role,
          'dor', s.query_text,
          'clicado_em', c.created_at
        ) as x
        from clique c
        join public.profiles p on p.id = c.profile_id
        left join public.searches s on s.id = c.search_id
        order by c.created_at desc
        limit 10
      ) t
    ), '[]'::jsonb),

    'serie', coalesce((
      select jsonb_agg(jsonb_build_object('dia', d, 'cliques', n) order by d)
      from (
        select created_at::date as d, count(*) as n
        from clique group by created_at::date
      ) t
    ), '[]'::jsonb)
  ) into resultado;

  return resultado;
end;
$function$;

comment on function public.get_cta_insights(timestamptz, timestamptz) is
  'Relatório do CTA de parceiro: quem viu, quem clicou, taxa, perfil e a dor que precedeu o clique.';

-- ---------------------------------------------------------------------------
-- Ficha da pessoa: quantas vezes ela clicou no CTA de parceiro.
--
-- No dashboard o clique é taxa; aqui é sinal de intenção de UMA pessoa, que é
-- o que a equipe olha antes de ligar para ela.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_lead_detail(p_profile_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    -- O score vem com a composição junto. Número solto ninguém confia nem
    -- contesta; com as parcelas à vista, a equipe vê que a pessoa pontuou por
    -- ter voltado três dias seguidos, e não por ser dono de empresa.
    'score', public.score_do_lead_detalhe(p_profile_id),
    'faixa', public.faixa_do_score((public.score_do_lead_detalhe(p_profile_id)->>'total')::int),

    'resumo', (
      select jsonb_build_object(
        'total_buscas', (select count(*) from public.searches s where s.profile_id = p_profile_id),
        'trechos_abertos', (select count(*) from public.video_views w where w.profile_id = p_profile_id),
        'dias_ativos', (
          select count(distinct s.created_at::date) from public.searches s where s.profile_id = p_profile_id
        ),
        'cliques_cta', (select count(*) from public.cta_clicks c where c.profile_id = p_profile_id),
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
$function$;

-- ---------------------------------------------------------------------------
-- Clique no CTA passa a valer pontos no score.
--
-- É o sinal de intenção mais forte que a ferramenta tem hoje. Quem busca está
-- estudando; quem abre trecho está estudando com atenção; quem clica em falar
-- com o parceiro levantou a mão. Vale mais que abrir mais um trecho.
--
-- É BINÁRIO, não acumulativo: clicar dez vezes não é dez vezes mais interesse,
-- é a mesma pessoa voltando. Primeiro clique leva os 10 pontos inteiros.
--
-- O TETO CONTINUA 100 e a parcela de atividade continua valendo 45: os 10
-- pontos saíram de dentro dela, não por cima. Buscas caem de 20 para 15, dias
-- distintos de 15 para 12 e trechos abertos de 10 para 8. Todo mundo perde
-- alguns pontos com isso, o que é esperado: a régua ficou mais exigente porque
-- ganhou um sinal melhor do que os que já tinha.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.score_do_lead_detalhe(p_profile_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with uso as (
    select
      count(*) as buscas,
      count(distinct (created_at at time zone 'America/Sao_Paulo')::date) as dias,
      max(created_at) as ultima
    from public.searches
    where profile_id = p_profile_id
  ),
  aberturas as (
    select count(*) as trechos
    from public.video_views
    where profile_id = p_profile_id
  ),
  parceiro as (
    select count(*) as cliques
    from public.cta_clicks
    where profile_id = p_profile_id
  ),
  foco as (
    -- Concentração do tema dominante entre todos os temas detectados.
    select max(vezes)::numeric / nullif(sum(vezes), 0) as concentracao
    from (
      select t, count(*) as vezes
      from public.searches s, unnest(coalesce(s.detected_topics, array[]::text[])) t
      where s.profile_id = p_profile_id
      group by t
    ) x
  ),
  quem as (
    select coalesce(public.perfil_do_cargo(p.cargo), p.commercial_role) as perfil
    from public.profiles p
    where p.id = p_profile_id
  )
  ,
  pontos as (
    select
      case (select perfil from quem)
        when 'dono_empresa'     then 30
        when 'gestor_comercial' then 22
        when 'vendedor'         then 12
        else 8
      end as cargo,
      least(15, (select buscas from uso) * 5)
        + least(12, greatest(0, (select dias from uso) - 1) * 4)
        + least(8, (select trechos from aberturas) * 2)
        + case when (select cliques from parceiro) > 0 then 10 else 0 end as atividade,
      case
        when (select ultima from uso) is null then 0
        when (select ultima from uso) > now() - interval '7 days'  then 15
        when (select ultima from uso) > now() - interval '30 days' then 10
        when (select ultima from uso) > now() - interval '90 days' then 5
        else 0
      end as recencia,
      case
        when (select buscas from uso) < 2 then 0
        when coalesce((select concentracao from foco), 0) >= 0.6 then 10
        else 4
      end as foco
  )
  select jsonb_build_object(
    'total', least(100, greatest(0, cargo + atividade + recencia + foco))::int,
    'cargo', cargo,
    'atividade', atividade,
    'recencia', recencia,
    'foco', foco,
    'buscas', (select buscas from uso),
    'dias_ativos', (select dias from uso),
    'trechos_abertos', (select trechos from aberturas),
    'cliques_cta', (select cliques from parceiro)
  )
  from pontos;
$function$;
