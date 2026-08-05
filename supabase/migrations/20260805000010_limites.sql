-- ============================================================
-- LIMITE DE USO POR PESSOA
--
-- O acervo transcrito é o ativo do produto, e a busca é a única porta por onde
-- ele sai: 6 trechos por chamada. Sem freio, cerca de mil buscas automatizadas
-- extraem o acervo inteiro e ainda custam dinheiro de verdade, porque cada
-- busca dispara um embedding e um plano de ação no Claude Opus 5. Na conta de
-- 05/08/2026, ~US$ 0,06 por busca: mil buscas são ~US$ 58, dez mil são ~US$ 575,
-- sem teto.
--
-- Como o cadastro é aberto e sem confirmação de e-mail (decisão de produto, o
-- cadastro libera a busca na hora), criar contas é barato. Então o limite tem
-- de ser por pessoa E a conta precisa ser cara de multiplicar.
--
-- Os números são folgados para gente de verdade: quem pesquisa muito num dia
-- faz algumas dezenas de buscas. Para um script, 30 por hora transformam a
-- extração do acervo em semanas de trabalho barulhento, em vez de uma tarde.
-- ============================================================

create table if not exists public.limites_de_uso (
  papel text primary key,
  buscas_por_hora int not null,
  buscas_por_dia int not null,
  atualizado_em timestamptz not null default now()
);

comment on table public.limites_de_uso is
  'Teto de buscas por pessoa. Em tabela e não no código para poder afrouxar '
  'ou apertar sem republicar Edge Function.';

insert into public.limites_de_uso (papel, buscas_por_hora, buscas_por_dia)
values ('user', 30, 150)
on conflict (papel) do nothing;

alter table public.limites_de_uso enable row level security;

-- Leitura liberada a quem está logado: a pessoa pode saber quanto ainda pode
-- buscar. Escrita, ninguém pelo frontend (só service_role, que ignora RLS).
drop policy if exists "limites_select_authenticated" on public.limites_de_uso;
create policy "limites_select_authenticated" on public.limites_de_uso
  for select to authenticated using (true);

-- ------------------------------------------------------------
-- Quanto a pessoa ainda pode buscar
--
-- Conta em cima de `searches`, que já é o registro autoritativo. Não existe
-- contador paralelo para dessincronizar.
-- ------------------------------------------------------------
create or replace function public.limite_de_busca()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  por_hora int;
  por_dia int;
  usadas_hora int;
  usadas_dia int;
begin
  if uid is null then
    return jsonb_build_object('permitido', false, 'motivo', 'nao_autenticado');
  end if;

  -- Staff testa o produto o dia inteiro; limitar a equipe só atrapalharia.
  if public.is_concer_staff() then
    return jsonb_build_object('permitido', true, 'ilimitado', true);
  end if;

  select l.buscas_por_hora, l.buscas_por_dia into por_hora, por_dia
  from public.limites_de_uso l where l.papel = 'user';

  select count(*) into usadas_hora
  from public.searches s
  where s.profile_id = uid and s.created_at > now() - interval '1 hour';

  select count(*) into usadas_dia
  from public.searches s
  where s.profile_id = uid and s.created_at > now() - interval '1 day';

  return jsonb_build_object(
    'permitido', usadas_hora < por_hora and usadas_dia < por_dia,
    'motivo', case
      when usadas_hora >= por_hora then 'limite_por_hora'
      when usadas_dia >= por_dia then 'limite_por_dia'
      else null
    end,
    'restantes_hora', greatest(0, por_hora - usadas_hora),
    'restantes_dia', greatest(0, por_dia - usadas_dia),
    'ilimitado', false
  );
end;
$$;

revoke all on function public.limite_de_busca() from public, anon;
grant execute on function public.limite_de_busca() to authenticated;
-- ============================================================
-- A trava de uso passa a valer dentro da search_videos
--
-- Checar só na Edge Function protegeria o caminho do app e deixaria aberto o
-- caminho direto: qualquer pessoa logada pode chamar a RPC com o próprio JWT.
-- O limite tem de estar onde o dado sai.
-- ============================================================

create or replace function public.search_videos(
  query_embedding vector(1536),
  match_count int default 5,
  query_text text default '',
  detected_topics text[] default null,
  min_similarity float default 0.15
)
returns table (
  search_id uuid,
  video_id uuid,
  youtube_video_id text,
  title text,
  thumbnail_url text,
  segment_id uuid,
  segment_text text,
  start_seconds int,
  end_seconds int,
  similarity_score float,
  rank_position int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_search_id uuid;
begin
  -- Regra crítica do PROCESSO: visitante sem cadastro não vê recomendação.
  if uid is null then
    raise exception 'É preciso estar autenticado para buscar insights.'
      using errcode = '42501';
  end if;

  if query_embedding is null then
    raise exception 'query_embedding é obrigatório.' using errcode = '22023';
  end if;

  -- Teto de uso. A trava mora AQUI, e não só na Edge Function, porque esta é
  -- a porta por onde o acervo sai: quem chamar a RPC direto com o proprio JWT
  -- tem de esbarrar no mesmo limite.
  declare
    limite jsonb := public.limite_de_busca();
  begin
    if not (limite->>'permitido')::boolean then
      raise exception 'Você atingiu o limite de buscas. Tente novamente mais tarde.'
        using errcode = 'P0001', detail = limite->>'motivo';
    end if;
  end;

  -- match_count entre 1 e 20 (protege contra abuso e custo de LLM depois)
  match_count := least(greatest(coalesce(match_count, 5), 1), 20);

  -- Registra a dor buscada e associa ao perfil (alimenta a segmentação
  -- de audiência: "cada dor pesquisada é registrada e associada ao perfil").
  insert into public.searches (profile_id, query_text, detected_topics)
  values (uid, coalesce(nullif(query_text, ''), '(sem texto)'), detected_topics)
  returning id into new_search_id;

  return query
  with ranked as (
    select
      v.id            as video_id,
      v.youtube_video_id,
      v.title,
      v.thumbnail_url,
      s.id            as segment_id,
      s.segment_text,
      s.start_seconds,
      s.end_seconds,
      -- pgvector: <=> é distância de cosseno (0 = idêntico)
      (1 - (s.embedding <=> query_embedding))::float as similarity_score
    from public.video_segments s
    join public.videos v on v.id = s.video_id
    where s.embedding is not null
      and v.transcription_status = 'indexed'   -- só vídeo indexado participa da busca
    order by s.embedding <=> query_embedding
    limit match_count
  ),
  filtrado as (
    select r.*, row_number() over (order by r.similarity_score desc)::int as rank_position
    from ranked r
    where r.similarity_score >= min_similarity
  ),
  persistido as (
    insert into public.search_results
      (search_id, video_id, segment_id, start_seconds, similarity_score, rank_position)
    select new_search_id, f.video_id, f.segment_id, f.start_seconds, f.similarity_score, f.rank_position
    from filtrado f
    returning 1
  )
  select
    new_search_id,
    f.video_id,
    f.youtube_video_id,
    f.title,
    f.thumbnail_url,
    f.segment_id,
    f.segment_text,
    f.start_seconds,
    f.end_seconds,
    f.similarity_score,
    f.rank_position
  from filtrado f
  order by f.rank_position;
end;
$$;
