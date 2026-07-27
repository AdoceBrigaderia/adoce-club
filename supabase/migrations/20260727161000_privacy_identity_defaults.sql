begin;

create or replace function private.normalize_site_feedback_privacy_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.category = 'privacy' then
    new.privacy_identity_status := coalesce(new.privacy_identity_status, 'pending');
  else
    new.privacy_identity_status := null;
    new.privacy_identity_checked_at := null;
    new.privacy_identity_checked_by := null;
    new.privacy_identity_notes := null;
  end if;
  return new;
end;
$$;

revoke all on function private.normalize_site_feedback_privacy_identity()
  from public, anon, authenticated;

update public.site_feedback
set privacy_identity_status = 'pending'
where category = 'privacy'
  and privacy_identity_status is null;

update public.site_feedback
set privacy_identity_status = null,
    privacy_identity_checked_at = null,
    privacy_identity_checked_by = null,
    privacy_identity_notes = null
where category <> 'privacy'
  and (
    privacy_identity_status is not null
    or privacy_identity_checked_at is not null
    or privacy_identity_checked_by is not null
    or privacy_identity_notes is not null
  );

drop trigger if exists site_feedback_privacy_identity_defaults on public.site_feedback;
create trigger site_feedback_privacy_identity_defaults
before insert or update of category, privacy_identity_status
on public.site_feedback
for each row
execute function private.normalize_site_feedback_privacy_identity();

commit;
