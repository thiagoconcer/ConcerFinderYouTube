-- ============================================================
-- VISÃO DE LEAD (pessoa a pessoa)
--
-- O painel de audiência fazia dois trabalhos ao mesmo tempo: leitura agregada
-- (quantos, quais temas, como cresce) e leitura individual (quem é fulano, o
-- que ele buscou). São ritmos diferentes: o agregado se lê de vez em quando, a
-- pessoa se consulta no dia a dia. Separar melhora os dois.
--
-- Estas RPCs servem a parte individual.
-- ============================================================

-- ------------------------------------------------------------
-- Lista de leads com o comportamento já resumido
--
-- Um único round-trip com tudo que a lista precisa mostrar, em vez de N+1
-- consultas por linha. Com a base pequena isso é irrelevante; com 5.000 leads
-- é a diferença entre a página abrir e a página travar.
-- ------------------------------------------------------------
create or replace function public.get_leads(
  p_busca text default null,
  p_perfil text default null,
  p_limit int default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  resultado jsonb;
  termo text := nullif(btrim(coalesce(p_busca, '')), '');
begin
  if not public.is_concer_staff() then
    raise exception 'Acesso restrito à equipe Concer.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(x order by x->>'ultima_atividade' desc nulls last), '[]'::jsonb)
  into resultado
  from (
    select jsonb_build_object(
      'profile_id', p.id,
      'nome', p.full_name,
      'email', p.email,
      'whatsapp', p.whatsapp,
      'cargo', p.cargo,
      'perfil_comercial', p.commercial_role,
      'papel', p.role,
      'cadastrado_em', p.created_at,
      'lead_id', l.id,
      'status_nutricao', l.nurture_status,
      'nutricao_enviada_em', l.nurture_sent_at,
      'total_buscas', (select count(*) from public.searches s where s.profile_id = p.id),
      'trechos_abertos', (select count(*) from public.video_views w where w.profile_id = p.id),
      'ultima_busca', (select max(s.created_at) from public.searches s where s.profile_id = p.id),
      'ultima_atividade', greatest(
        p.created_at,
        coalesce((select max(s.created_at) from public.searches s where s.profile_id = p.id), p.created_at),
        coalesce((select max(w.created_at) from public.video_views w where w.profile_id = p.id), p.created_at)
      ),
      'temas', coalesce((
        select jsonb_agg(distinct t)
        from public.searches s, unnest(coalesce(s.detected_topics, array[]::text[])) t
        where s.profile_id = p.id
      ), '[]'::jsonb),
      -- A dor mais recente é o que faz sentido ler numa lista: é o assunto
      -- que a pessoa tem na cabeça agora, não o de três semanas atrás.
      'ultima_dor', (
        select s.query_text from public.searches s
        where s.profile_id = p.id order by s.created_at desc limit 1
      )
    ) as x
    from public.profiles p
    left join public.leads l on l.profile_id = p.id
    where (p_perfil is null or p.commercial_role = p_perfil)
      and (
        termo is null
        or p.full_name ilike '%' || termo || '%'
        or p.email ilike '%' || termo || '%'
        or p.whatsapp ilike '%' || termo || '%'
        or exists (
          select 1 from public.searches s
          where s.profile_id = p.id and s.query_text ilike '%' || termo || '%'
        )
      )
    limit greatest(1, least(p_limit, 500))
  ) t;

  return resultado;
end;
$$;

revoke all on function public.get_leads(text, text, int) from public, anon;
grant execute on function public.get_leads(text, text, int) to authenticated;

-- ------------------------------------------------------------
-- Ficha completa de uma pessoa
--
-- Tudo que se sabe sobre ela em uma chamada: cadastro, buscas com os temas e
-- se geraram plano, e os trechos que abriu de verdade. A distância entre o que
-- foi recomendado e o que foi aberto é a leitura mais honesta de interesse.
-- ------------------------------------------------------------
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

revoke all on function public.get_lead_detail(uuid) from public, anon;
grant execute on function public.get_lead_detail(uuid) to authenticated;
