-- ============================================================
-- PAINEL: crescimento, ativação, qualidade e pauta de conteúdo
--
-- O painel de audiência já respondia "quem procura o quê". O que faltava:
--
--   . Crescimento. Não havia nenhuma série temporal, então não dava para
--     responder "estamos crescendo?", que é a pergunta mais básica.
--   . Ativação. A tese do produto é que o cadastro obrigatório gera lead
--     qualificado. Só que lead que se cadastra e nunca busca não é lead
--     qualificado, é e-mail. O funil é o que separa os dois.
--   . Qualidade. "Dores sem resposta" cobre o caso extremo (zero resultado).
--     O caso comum, e mais perigoso, é a busca que devolve algo fraco: a
--     pessoa acha que o acervo não tem, e vai embora sem reclamar.
--   . Pauta. Tema muito buscado que o acervo responde mal é pedido de vídeo
--     novo, vindo direto da audiência.
--
-- RPC separada de `get_audience_insights` pelo mesmo motivo da de cargo: é
-- pergunta nova, e a outra já tem 150 linhas que não precisam mudar.
-- ============================================================

create or replace function public.get_engagement_insights(
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

  with dia as (
    select generate_series(date_trunc('day', inicio), date_trunc('day', fim), interval '1 day')::date as d
  ),
  busca as (
    select s.id, s.profile_id, s.detected_topics, s.action_plan, s.created_at
    from public.searches s
    where s.created_at between inicio and fim
  ),
  -- relevância de cada busca: o melhor trecho que ela conseguiu devolver.
  -- A média de todos os trechos puniria uma busca boa que trouxe 6 resultados
  -- sendo o primeiro ótimo, que é exatamente o comportamento desejado.
  relevancia_da_busca as (
    select b.id, max(r.similarity_score) as melhor
    from busca b
    join public.search_results r on r.search_id = b.id
    group by b.id
  ),
  tema_busca as (
    select unnest(coalesce(b.detected_topics, array[]::text[])) as topico, b.id
    from busca b
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('de', inicio, 'ate', fim),

    -- ------------------------------------------------------------
    -- Crescimento: uma linha por dia, com zero nos dias sem movimento
    -- (sem os zeros o gráfico mente, porque une dois picos distantes).
    -- ------------------------------------------------------------
    'serie', coalesce((
      select jsonb_agg(jsonb_build_object(
        'dia', d.d,
        'cadastros', (select count(*) from public.profiles p where p.created_at::date = d.d),
        'buscas',    (select count(*) from public.searches s where s.created_at::date = d.d),
        'aberturas', (select count(*) from public.video_views w where w.created_at::date = d.d)
      ) order by d.d)
      from dia d
    ), '[]'::jsonb),

    -- ------------------------------------------------------------
    -- Funil de ativação, sobre a base inteira e não sobre o período:
    -- é a leitura da tese do produto, não do mês.
    -- ------------------------------------------------------------
    'funil', (
      select jsonb_build_object(
        'cadastraram', (select count(*) from public.profiles),
        'buscaram',    (select count(distinct profile_id) from public.searches),
        'abriram',     (select count(distinct profile_id) from public.video_views),
        'voltaram',    (
          select count(*) from (
            select profile_id from public.searches
            group by profile_id having count(distinct created_at::date) > 1
          ) t
        )
      )
    ),

    -- ------------------------------------------------------------
    -- Qualidade da busca no período
    -- ------------------------------------------------------------
    'qualidade', (
      select jsonb_build_object(
        'buscas', (select count(*) from busca),
        'buscas_com_plano', (select count(*) from busca where action_plan is not null),
        'buscas_sem_resultado', (
          select count(*) from busca b
          where not exists (select 1 from public.search_results r where r.search_id = b.id)
        ),
        'relevancia_media', (select round(avg(melhor)::numeric, 3) from relevancia_da_busca),
        'relevancia_minima', (select round(min(melhor)::numeric, 3) from relevancia_da_busca),
        'recomendacoes', (
          select count(*) from public.search_results r
          join busca b on b.id = r.search_id
        ),
        'aberturas', (select count(*) from public.video_views w where w.created_at between inicio and fim),
        'buscas_por_pessoa', (
          select round(count(*)::numeric / nullif(count(distinct profile_id), 0), 1) from busca
        )
      )
    ),

    -- ------------------------------------------------------------
    -- Pauta de conteúdo: muito buscado + acervo respondendo mal.
    -- Ordenado por buscas, com a relevância ao lado para leitura.
    -- ------------------------------------------------------------
    'demanda_por_tema', coalesce((
      select jsonb_agg(x order by (x->>'buscas')::int desc)
      from (
        select jsonb_build_object(
          'topico', t.topico,
          'buscas', count(distinct t.id),
          'relevancia_media', round(avg(rb.melhor)::numeric, 3),
          'trechos_no_acervo', (
            select count(*) from public.video_segments vs
            where vs.topic_tags @> array[t.topico]
          )
        ) as x
        from tema_busca t
        left join relevancia_da_busca rb on rb.id = t.id
        where t.topico is not null and t.topico <> ''
        group by t.topico
        order by count(distinct t.id) desc
        limit 15
      ) y
    ), '[]'::jsonb),

    -- ------------------------------------------------------------
    -- Acervo ocioso: indexado e nunca recomendado. É conteúdo pronto,
    -- já pago, que a busca nunca encontrou. Vale rever título ou tema.
    -- ------------------------------------------------------------
    'acervo', (
      select jsonb_build_object(
        'indexados', (select count(*) from public.videos where indexed_at is not null),
        'ja_recomendados', (
          select count(distinct r.video_id) from public.search_results r
        ),
        'nunca_recomendados', (
          select count(*) from public.videos v
          where v.indexed_at is not null
            and not exists (select 1 from public.search_results r where r.video_id = v.id)
        ),
        'amostra', coalesce((
          select jsonb_agg(jsonb_build_object(
            'video_id', v.id,
            'youtube_video_id', v.youtube_video_id,
            'title', v.title,
            'thumbnail_url', v.thumbnail_url,
            'trechos', (select count(*) from public.video_segments s where s.video_id = v.id)
          ) order by v.published_at desc nulls last)
          from (
            select * from public.videos v2
            where v2.indexed_at is not null
              and not exists (select 1 from public.search_results r where r.video_id = v2.id)
            order by v2.published_at desc nulls last
            limit 6
          ) v
        ), '[]'::jsonb)
      )
    ),

    -- ------------------------------------------------------------
    -- Recorrência: em quantos dias distintos cada pessoa buscou.
    -- Uma vez só é curiosidade; voltar é hábito, e hábito é o que
    -- sustenta a audiência que vai ser oferecida a um parceiro.
    -- ------------------------------------------------------------
    'recorrencia', coalesce((
      select jsonb_agg(jsonb_build_object('dias_ativos', dias_ativos, 'pessoas', pessoas)
                       order by dias_ativos)
      from (
        select dias_ativos, count(*) as pessoas
        from (
          -- 5+ vira um balde só: além disso a cauda é longa e some no gráfico
          select profile_id, least(count(distinct created_at::date), 5) as dias_ativos
          from public.searches
          group by profile_id
        ) por_pessoa
        group by dias_ativos
      ) p
    ), '[]'::jsonb)
  ) into resultado;

  return resultado;
end;
$$;

revoke all on function public.get_engagement_insights(timestamptz, timestamptz) from public, anon;
grant execute on function public.get_engagement_insights(timestamptz, timestamptz) to authenticated;
