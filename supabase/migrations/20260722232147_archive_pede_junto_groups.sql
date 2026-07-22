alter table public.pede_junto_groups
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null;

create index if not exists pede_junto_groups_archive_idx
  on public.pede_junto_groups(archived_at, created_at desc);

create or replace function public.staff_archive_pede_junto_group(
  target_group_id uuid,
  should_archive boolean default true
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target public.pede_junto_groups%rowtype;
begin
  if (select auth.uid()) is null or not (select private.is_staff()) then
    raise exception 'Acesso restrito à equipe Adoce';
  end if;

  select * into target
  from public.pede_junto_groups
  where id = target_group_id
  for update;
  if not found then raise exception 'Grupo não encontrado'; end if;

  if should_archive and target.status not in ('completed', 'cancelled', 'expired') then
    raise exception 'Conclua ou cancele o grupo antes de arquivá-lo';
  end if;

  update public.pede_junto_groups
  set archived_at = case when should_archive then now() else null end,
      archived_by = case when should_archive then (select auth.uid()) else null end,
      updated_at = now()
  where id = target.id;

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values ((select auth.uid()),
    case when should_archive then 'pede_junto.archived' else 'pede_junto.restored' end,
    'pede_junto_group', target.id::text,
    jsonb_build_object('public_code', target.public_code, 'status', target.status));
end;
$$;

revoke all on function public.staff_archive_pede_junto_group(uuid,boolean)
  from public, anon, authenticated;
grant execute on function public.staff_archive_pede_junto_group(uuid,boolean)
  to authenticated;
