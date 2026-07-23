-- Proprietários podem redefinir o acesso de colaboradores e clientes sem
-- conhecer a senha anterior. A senha temporária exige troca no primeiro acesso.

alter table public.staff_members
  add column if not exists must_change_password boolean not null default false;

alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

create or replace function public.complete_forced_password_change()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Sessão obrigatória';
  end if;

  update public.profiles
  set must_change_password = false,
      auth_upgraded_at = coalesce(auth_upgraded_at, now()),
      updated_at = now()
  where id = (select auth.uid());

  update public.staff_members
  set must_change_password = false
  where user_id = (select auth.uid());

  insert into public.audit_events (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    payload
  )
  values (
    (select auth.uid()),
    'security.temporary_password_changed',
    'profile',
    (select auth.uid())::text,
    jsonb_build_object('completed_at', now())
  );
end;
$$;

revoke all on function public.complete_forced_password_change()
  from public, anon, authenticated;
grant execute on function public.complete_forced_password_change()
  to authenticated;
