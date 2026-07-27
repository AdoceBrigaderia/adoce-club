begin;

do $$
declare
  actor_id uuid;
  target_profile_id uuid;
  target_request_id uuid;
  review_result jsonb;
  stored_ready boolean;
  stored_blockers jsonb;
  audit_exists boolean;
begin
  select member.user_id
  into actor_id
  from public.staff_members member
  where member.active
    and member.role::text in ('owner', 'manager')
  order by case member.role::text when 'owner' then 1 else 2 end
  limit 1;

  if actor_id is null then
    raise exception 'Homologação precisa de proprietário ou gestor ativo para o ensaio';
  end if;

  select profile.id
  into target_profile_id
  from public.profiles profile
  where coalesce(profile.active, true)
    and not exists (
      select 1
      from public.staff_members member
      where member.user_id = profile.id
        and member.active
    )
  order by profile.created_at
  limit 1;

  if target_profile_id is null then
    raise exception 'Homologação precisa de ao menos um cliente ativo para o ensaio';
  end if;

  insert into public.site_feedback(
    protocol,
    public_request_key,
    profile_id,
    category,
    customer_name,
    customer_email,
    customer_phone,
    page_url,
    message,
    privacy_request_type,
    privacy_due_at,
    privacy_identity_status,
    privacy_identity_checked_at,
    privacy_identity_checked_by,
    privacy_identity_notes
  )
  select
    'PRIV-DEL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
    gen_random_uuid(),
    profile.id,
    'privacy',
    profile.full_name,
    profile.email,
    profile.phone_e164,
    'https://homologacao-adoce--adoce-homologacao.netlify.app/#operacao',
    'Solicitação temporária para validar a revisão de anonimização com rollback.',
    'deletion',
    now() + interval '15 days',
    'verified',
    now(),
    actor_id,
    'Identidade confirmada no ensaio transacional.'
  from public.profiles profile
  where profile.id = target_profile_id
  returning id into target_request_id;

  perform set_config('request.jwt.claim.sub', actor_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', actor_id, 'role', 'authenticated')::text,
    true
  );

  review_result := public.staff_review_privacy_anonymization(target_request_id);

  if jsonb_typeof(review_result->'blockers') not in ('object', 'array') then
    raise exception 'Revisão não retornou bloqueadores estruturados';
  end if;
  if review_result->>'status' is distinct from 'reviewing' then
    raise exception 'Solicitação não permaneceu em análise após a revisão';
  end if;
  if review_result->>'ready' not in ('true', 'false') then
    raise exception 'Revisão não retornou decisão booleana de prontidão';
  end if;

  select
    feedback.privacy_deletion_ready,
    feedback.privacy_deletion_blockers
  into stored_ready, stored_blockers
  from public.site_feedback feedback
  where feedback.id = target_request_id;

  if stored_ready is null
     or jsonb_typeof(coalesce(stored_blockers, '{}'::jsonb)) not in ('object', 'array') then
    raise exception 'Resultado da revisão não foi persistido corretamente';
  end if;

  select exists(
    select 1
    from public.audit_events event
    where event.action = 'privacy_request.anonymization_reviewed'
      and event.entity_id = target_request_id::text
      and event.payload->>'profile_id' = target_profile_id::text
  ) into audit_exists;

  if not audit_exists then
    raise exception 'Auditoria da revisão de anonimização não foi registrada';
  end if;

  if has_function_privilege(
    'anon',
    'public.staff_review_privacy_anonymization(uuid)'::regprocedure,
    'EXECUTE'
  ) then
    raise exception 'RPC de revisão de anonimização exposto ao anônimo';
  end if;
end;
$$;

rollback;
