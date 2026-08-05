-- ============================================================
-- ConcerFinder — Papel de administrador e proteção contra escalação
--
-- MOTIVO (falha encontrada em 05/08/2026): a policy `profiles_update_own_or_staff`
-- permite ao dono atualizar o próprio perfil, o que é correto para nome e
-- WhatsApp, mas deixava a coluna `role` editável pelo próprio usuário. Na
-- prática, qualquer cadastrado fazia PATCH em profiles.role, virava staff e
-- passava a ler a tabela `leads` inteira (nome, e-mail e WhatsApp de todos).
--
-- Correção: um trigger bloqueia mudança de `role` por quem não é admin. RLS
-- sozinha não resolve, porque a policy é por linha, não por coluna.
--
-- Rodar depois de db/schemas.sql. Idempotente.
-- ============================================================

-- ============================================================
-- 1. Novo papel: admin
-- ============================================================
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('user', 'content_admin', 'audience_manager', 'admin'));

comment on column public.profiles.role is
  'user: usuário comum. content_admin: painel de conteúdo. audience_manager: painel de audiência. '
  'admin: os dois painéis mais a gestão de papéis da equipe. Só admin altera role.';

-- ============================================================
-- 2. Helpers
-- ============================================================

/** Admin do sistema: staff com poder de gerir papéis. */
create or replace function public.is_concer_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

/** Staff Concer. `admin` entra aqui: quem administra também enxerga os painéis. */
create or replace function public.is_concer_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('content_admin', 'audience_manager', 'admin')
  );
$$;

-- ============================================================
-- 3. Trava de escalação de privilégio
-- ============================================================
create or replace function public.protege_papel_do_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    -- auth.uid() nulo = service_role ou contexto interno (SQL editor, migration).
    -- Usuário autenticado só muda papel se for admin.
    if auth.uid() is not null and not public.is_concer_admin() then
      raise exception 'Somente um administrador pode alterar o papel de um usuário.'
        using errcode = '42501';
    end if;

    -- Um admin não pode se rebaixar sozinho: evita a organização ficar sem
    -- nenhum admin por engano.
    if auth.uid() = new.id and old.role = 'admin' and new.role <> 'admin' then
      raise exception 'Um administrador não pode remover o próprio acesso de administrador.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_protege_papel on public.profiles;
create trigger trg_profiles_protege_papel
  before update on public.profiles
  for each row execute function public.protege_papel_do_profile();

-- ============================================================
-- 4. RPC: lista a equipe (admin-only)
-- ============================================================
create or replace function public.get_equipe()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_concer_admin() then
    raise exception 'Acesso restrito ao administrador.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(x order by x->>'full_name')
    from (
      select jsonb_build_object(
        'id', p.id,
        'full_name', p.full_name,
        'email', p.email,
        'commercial_role', p.commercial_role,
        'role', p.role,
        'created_at', p.created_at,
        'buscas', (select count(*) from public.searches s where s.profile_id = p.id)
      ) as x
      from public.profiles p
    ) t
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_equipe() from public, anon;
grant execute on function public.get_equipe() to authenticated;

-- ============================================================
-- 5. RPC: define o papel de um usuário (admin-only)
-- ============================================================
create or replace function public.definir_papel(p_profile_id uuid, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  atualizado record;
begin
  if not public.is_concer_admin() then
    raise exception 'Acesso restrito ao administrador.' using errcode = '42501';
  end if;

  if p_role not in ('user', 'content_admin', 'audience_manager', 'admin') then
    raise exception 'Papel inválido: %', p_role using errcode = '22023';
  end if;

  if p_profile_id = auth.uid() and p_role <> 'admin' then
    raise exception 'Você não pode remover o próprio acesso de administrador.'
      using errcode = '42501';
  end if;

  update public.profiles set role = p_role
  where id = p_profile_id
  returning id, full_name, email, role into atualizado;

  if not found then
    raise exception 'Usuário não encontrado.' using errcode = 'P0002';
  end if;

  return to_jsonb(atualizado);
end;
$$;

revoke all on function public.definir_papel(uuid, text) from public, anon;
grant execute on function public.definir_papel(uuid, text) to authenticated;
