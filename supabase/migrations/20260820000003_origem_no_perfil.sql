-- ---------------------------------------------------------------------------
-- A ficha da pessoa mostra a origem inteira, não só a derivada.
--
-- O relatório de captação responde "qual canal traz gente", e para isso a
-- origem derivada (utm_source, senão o domínio do referrer, senão 'direto') é a
-- leitura certa: ela cabe numa coluna e compara canais entre si.
--
-- Na ficha de UMA pessoa a pergunta é outra, e é operacional: de qual anúncio
-- veio, de qual link do grupo, em que página caiu. Aí a derivada atrapalha,
-- porque duas pessoas de "whatsapp" podem ter vindo de disparos diferentes, e é
-- exatamente essa diferença que decide o que falar com ela. Então a ficha passa
-- a devolver os campos como foram capturados, mais o referrer e a landing.
--
-- Só isso muda em get_lead_detail; o resto do corpo é o que já estava no ar.
-- ---------------------------------------------------------------------------

create or replace function public.get_lead_detail(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

    /*
      Origem completa, crua. O painel de captação mostra a origem DERIVADA
      (utm_source, senão o domínio do referrer, senão 'direto'), que é a leitura
      certa para comparar canais. Aqui a pergunta é outra: a equipe está olhando
      UMA pessoa antes de falar com ela, e quer saber de qual anúncio, de qual
      link e de qual página ela veio. Para isso a derivada esconde justamente o
      que interessa, então vão os campos como foram capturados.
    */
    'origem', (
      select jsonb_build_object(
        'origem', public.origem_do_lead(l.utm_source, l.referrer),
        'utm_source', l.utm_source,
        'utm_medium', l.utm_medium,
        'utm_campaign', l.utm_campaign,
        'utm_content', l.utm_content,
        'utm_term', l.utm_term,
        'referrer', l.referrer,
        'landing_page', l.landing_page,
        'capturado_em', l.created_at
      )
      from public.leads l
      where l.profile_id = p_profile_id
    ),

    'score', public.score_do_lead_detalhe(p_profile_id),
    'faixa', public.faixa_do_score((public.score_do_lead_detalhe(p_profile_id)->>'total')::int),

    'resumo', (
      select jsonb_build_object(
        'total_buscas', (select count(*) from public.searches s where s.profile_id = p_profile_id),
        'trechos_abertos', (select count(*) from public.video_views w where w.profile_id = p_profile_id),
        'dias_ativos', (
          select count(distinct s.created_at::date) from public.searches s where s.profile_id = p_profile_id
        ),
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
        'respondeu_contexto', (s.context_answer is not null),
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
$$;
