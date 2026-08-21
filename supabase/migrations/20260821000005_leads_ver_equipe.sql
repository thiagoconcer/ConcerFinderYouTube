-- ---------------------------------------------------------------------------
-- A lista de leads passa a ter três leituras de conta interna, não duas.
--
-- O booleano só sabia dizer "esconde" ou "mostra junto com todo mundo". Quando
-- alguém procura um admin, a pergunta é a terceira: mostrar SÓ a equipe. Com o
-- booleano, achar a Bárbara no meio de 33 leads exigia procurar pelo nome, e
-- quem não lembra o nome não acha.
-- ---------------------------------------------------------------------------

drop function if exists public.get_leads(text, text, integer, text, text, text, text, text, text, timestamptz, boolean);

CREATE OR REPLACE FUNCTION public.get_leads(p_busca text DEFAULT NULL::text, p_perfil text DEFAULT NULL::text, p_limit integer DEFAULT 100, p_cargo text DEFAULT NULL::text, p_origem text DEFAULT NULL::text, p_regua text DEFAULT NULL::text, p_tema text DEFAULT NULL::text, p_faixa text DEFAULT NULL::text, p_atividade text DEFAULT NULL::text, p_desde timestamp with time zone DEFAULT NULL::timestamp with time zone, p_internos text DEFAULT 'excluir'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  resultado jsonb;
  termo text := nullif(btrim(coalesce(p_busca, '')), '');
begin
  if not public.is_concer_staff() then
    raise exception 'Acesso restrito à equipe Concer.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(x order by (x->>'score')::int desc, x->>'ultima_atividade' desc nulls last), '[]'::jsonb)
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
      'interno', p.is_internal,
      'cadastrado_em', p.created_at,
      'lead_id', l.id,
      'status_nutricao', l.nurture_status,
      'nutricao_enviada_em', l.nurture_sent_at,
      -- A origem sai da mesma função do relatório de captação: UTM, senão o
      -- domínio do referrer, senão 'direto'. Nunca o campo cru.
      'origem', public.origem_do_lead(l.utm_source, l.referrer),
      'campanha', l.utm_campaign,
      'score', (sc.detalhe->>'total')::int,
      'faixa', public.faixa_do_score((sc.detalhe->>'total')::int),
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
    -- lateral para o score sair de UMA avaliação por pessoa: chamar a função
    -- no select, no order by e na faixa custaria três varreduras por linha.
    cross join lateral (select public.score_do_lead_detalhe(p.id) as detalhe) sc
    where (case coalesce(p_internos, 'excluir')
              when 'apenas' then p.is_internal
              when 'incluir' then true
              else not p.is_internal
            end)
      and (p_perfil is null or p.commercial_role = p_perfil)
      and (p_cargo is null or coalesce(p.cargo, 'nao_informado') = p_cargo)
      and (p_desde is null or p.created_at >= p_desde)
      and (p_origem is null or public.origem_do_lead(l.utm_source, l.referrer) = p_origem)
      -- 'sem_regua' é quem nunca entrou (não tem linha em leads), diferente de
      -- quem entrou e falhou. Na lista as duas situações pedem ação oposta.
      and (
        p_regua is null
        or (p_regua = 'sem_regua' and l.id is null)
        or l.nurture_status = p_regua
      )
      and (
        p_faixa is null
        or public.faixa_do_score((sc.detalhe->>'total')::int) = p_faixa
      )
      and (
        p_tema is null
        or exists (
          select 1 from public.searches s
          where s.profile_id = p.id and p_tema = any(coalesce(s.detected_topics, array[]::text[]))
        )
      )
      and (
        p_atividade is null
        or (p_atividade = 'buscou' and exists (select 1 from public.searches s where s.profile_id = p.id))
        or (p_atividade = 'nao_buscou' and not exists (select 1 from public.searches s where s.profile_id = p.id))
        or (p_atividade = 'abriu_trecho' and exists (select 1 from public.video_views w where w.profile_id = p.id))
        or (p_atividade = 'clicou_convite' and exists (select 1 from public.cta_clicks c where c.profile_id = p.id))
      )
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
    order by (sc.detalhe->>'total')::int desc, p.created_at desc
    limit greatest(1, least(p_limit, 500))
  ) t;

  return resultado;
end;
$function$
;


revoke all on function public.get_leads(text, text, integer, text, text, text, text, text, text, timestamptz, text) from public, anon;
grant execute on function public.get_leads(text, text, integer, text, text, text, text, text, text, timestamptz, text) to authenticated;
