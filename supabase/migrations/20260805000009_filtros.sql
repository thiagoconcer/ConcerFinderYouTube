-- ============================================================
-- O FILTRO DE PERFIL PASSA A VALER NO PAINEL INTEIRO
--
-- O seletor "Todos os perfis" só chegava em parte da tela: `get_audience_
-- insights` recebia o perfil, mas `get_cargo_insights` e `get_engagement_
-- insights` eram chamadas sem filtro nenhum. Crescimento, funil, qualidade,
-- pauta e cargos continuavam mostrando a base inteira enquanto o seletor dizia
-- "Vendedor".
--
-- Pior que não filtrar é filtrar pela metade: a pessoa lê a tela inteira como
-- se fosse do recorte escolhido, e metade dela não é.
--
-- Dentro da própria get_audience_insights o filtro também era parcial: totais,
-- leads por perfil e status de nutrição contavam a base toda.
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
        'leads', (select count(*) from public.leads l
                   where filter_commercial_role is null or l.commercial_role = filter_commercial_role),
        'perfis', (select count(*) from public.profiles pf
                    where filter_commercial_role is null or pf.commercial_role = filter_commercial_role),
        'buscas', (select count(*) from busca),
        'visualizacoes', (select count(*) from public.video_views w
                           join public.profiles pv on pv.id = w.profile_id
                           where w.created_at between inicio and fim
                             and (filter_commercial_role is null or pv.commercial_role = filter_commercial_role)),
        'videos_indexados', (select count(*) from public.videos where transcription_status = 'indexed')
      )
    ),

    'leads_por_perfil', coalesce((
      select jsonb_agg(x order by x->>'commercial_role')
      from (
        select jsonb_build_object('commercial_role', commercial_role, 'total', count(*)) as x
        from public.leads
        where filter_commercial_role is null or commercial_role = filter_commercial_role
        group by commercial_role
      ) t
    ), '[]'::jsonb),

    'nutricao', coalesce((
      select jsonb_object_agg(nurture_status, total)
      from (select nurture_status, count(*) as total from public.leads
            where filter_commercial_role is null or commercial_role = filter_commercial_role
            group by nurture_status) t
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

create or replace function public.get_cargo_insights(
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

  with pessoa as (
    select p.id, coalesce(p.cargo, 'nao_informado') as cargo, p.commercial_role
    from public.profiles p
    where filter_commercial_role is null or p.commercial_role = filter_commercial_role
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

create or replace function public.get_engagement_insights(
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

  with alvo as (
    select p.id, p.created_at
    from public.profiles p
    where filter_commercial_role is null or p.commercial_role = filter_commercial_role
  ),
  dia as (
    select generate_series(date_trunc('day', inicio), date_trunc('day', fim), interval '1 day')::date as d
  ),
  busca as (
    select s.id, s.profile_id, s.detected_topics, s.action_plan, s.created_at
    from public.searches s
    join alvo a on a.id = s.profile_id
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
        'cadastros', (select count(*) from alvo a where a.created_at::date = d.d),
        'buscas',    (select count(*) from public.searches s join alvo a on a.id = s.profile_id
                      where s.created_at::date = d.d),
        'aberturas', (select count(*) from public.video_views w join alvo a on a.id = w.profile_id
                      where w.created_at::date = d.d)
      ) order by d.d)
      from dia d
    ), '[]'::jsonb),

    -- ------------------------------------------------------------
    -- Funil de ativação, sobre a base inteira e não sobre o período:
    -- é a leitura da tese do produto, não do mês.
    -- ------------------------------------------------------------
    'funil', (
      select jsonb_build_object(
        'cadastraram', (select count(*) from alvo),
        'buscaram',    (select count(distinct s.profile_id) from public.searches s join alvo a on a.id = s.profile_id),
        'abriram',     (select count(distinct w.profile_id) from public.video_views w join alvo a on a.id = w.profile_id),
        'voltaram',    (
          select count(*) from (
            select s.profile_id from public.searches s join alvo a on a.id = s.profile_id
            group by s.profile_id having count(distinct s.created_at::date) > 1
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
        'aberturas', (select count(*) from public.video_views w join alvo a on a.id = w.profile_id
                      where w.created_at between inicio and fim),
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
          join busca b on b.id = r.search_id
        ),
        'nunca_recomendados', (
          select count(*) from public.videos v
          where v.indexed_at is not null
            and not exists (
              select 1 from public.search_results r join busca b on b.id = r.search_id
              where r.video_id = v.id
            )
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
              and not exists (
                select 1 from public.search_results r join busca b on b.id = r.search_id
                where r.video_id = v2.id
              )
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
          select s.profile_id, least(count(distinct s.created_at::date), 5) as dias_ativos
          from public.searches s join alvo a on a.id = s.profile_id
          group by s.profile_id
        ) por_pessoa
        group by dias_ativos
      ) p
    ), '[]'::jsonb)
  ) into resultado;

  return resultado;
end;
$$;

-- Assinaturas antigas saem de cena: com um parametro novo o Postgres cria
-- uma SOBRECARGA, e o PostgREST passaria a ver duas funcoes de mesmo nome.
drop function if exists public.get_cargo_insights(timestamptz, timestamptz);
drop function if exists public.get_engagement_insights(timestamptz, timestamptz);

revoke all on function public.get_cargo_insights(timestamptz, timestamptz, text) from public, anon;
grant execute on function public.get_cargo_insights(timestamptz, timestamptz, text) to authenticated;
revoke all on function public.get_engagement_insights(timestamptz, timestamptz, text) from public, anon;
grant execute on function public.get_engagement_insights(timestamptz, timestamptz, text) to authenticated;
