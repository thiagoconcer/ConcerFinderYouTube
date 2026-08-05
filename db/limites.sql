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
