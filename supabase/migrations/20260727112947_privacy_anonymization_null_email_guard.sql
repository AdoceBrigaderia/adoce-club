begin;

alter function public.staff_anonymize_privacy_profile(uuid,text)
  set schema private;

alter function private.staff_anonymize_privacy_profile(uuid,text)
  rename to staff_anonymize_privacy_profile_core;

revoke all on function private.staff_anonymize_privacy_profile_core(uuid,text)
  from public, anon, authenticated;

create or replace function public.staff_anonymize_privacy_profile(
  target_feedback_id uuid,
  requested_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_profile_id uuid;
  request_email text;
begin
  if (select auth.uid()) is null or private.current_staff_role()::text <> 'owner' then
    raise exception 'Somente o proprietário pode executar anonimização';
  end if;

  select feedback.profile_id, profile.email
  into request_profile_id, request_email
  from public.site_feedback feedback
  left join public.profiles profile on profile.id = feedback.profile_id
  where feedback.id = target_feedback_id
    and feedback.category = 'privacy'
    and feedback.privacy_request_type = 'deletion'
  for update of feedback;

  if request_profile_id is null then
    raise exception 'Solicitação de anonimização sem cadastro vinculado';
  end if;

  if nullif(btrim(coalesce(request_email, '')), '') is null then
    raise exception 'Cadastro sem e-mail exige revisão manual antes da anonimização';
  end if;

  return private.staff_anonymize_privacy_profile_core(
    target_feedback_id,
    requested_confirmation
  );
end;
$$;

revoke all on function public.staff_anonymize_privacy_profile(uuid,text)
  from public, anon;
grant execute on function public.staff_anonymize_privacy_profile(uuid,text)
  to authenticated;

commit;
