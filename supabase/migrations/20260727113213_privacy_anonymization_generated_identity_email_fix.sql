begin;

do $$
declare
  function_definition text;
  corrected_definition text;
  occurrence_count integer;
begin
  select pg_get_functiondef(
    'private.staff_anonymize_privacy_profile_core(uuid,text)'::regprocedure
  ) into function_definition;

  occurrence_count := (
    char_length(function_definition)
    - char_length(replace(function_definition, 'email = anonymous_email,', ''))
  ) / char_length('email = anonymous_email,');

  if occurrence_count < 2 then
    raise exception 'Estrutura inesperada da função de anonimização: % ocorrência(s)', occurrence_count;
  end if;

  corrected_definition := replace(
    function_definition,
    'email = anonymous_email,',
    ''
  );

  execute corrected_definition;
end;
$$;

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
  anonymous_email text;
  result jsonb;
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

  anonymous_email := 'deleted+' || replace(request_profile_id::text, '-', '') || '@users.invalid';

  result := private.staff_anonymize_privacy_profile_core(
    target_feedback_id,
    requested_confirmation
  );

  update auth.users
  set email = anonymous_email,
      updated_at = now()
  where id = request_profile_id;

  return result;
end;
$$;

revoke all on function public.staff_anonymize_privacy_profile(uuid,text)
  from public, anon;
grant execute on function public.staff_anonymize_privacy_profile(uuid,text)
  to authenticated;

commit;
