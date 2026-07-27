begin;

do $$
declare
  actor_id uuid;
  target_profile_id uuid;
  original_name text;
  correction_id uuid;
  consent_id uuid;
  correction_result jsonb;
  consent_result jsonb;
  corrected_name text;
  latest_marketing boolean;
  preference_record public.notification_preferences%rowtype;
  correction_audit boolean;
  consent_audit boolean;
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

  select profile.id, profile.full_name
  into target_profile_id, original_name
  from public.profiles profile
  where coalesce(profile.active, true)
  order by profile.created_at
  limit 1;

  if target_profile_id is null then
    raise exception 'Homologação precisa de ao menos um cadastro ativo para o ensaio';
  end if;

  insert into public.site_feedback(
    protocol,
    public_request_key,
    profile_id,
    category,
    customer_name,
    customer_email,
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
    'PRIV-CORR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
    gen_random_uuid(),
    profile.id,
    'privacy',
    profile.full_name,
    profile.email,
    'https://homologacao-adoce--adoce-homologacao.netlify.app/#operacao',
    'Solicitação temporária para validar correção de nome com rollback.',
    'correction',
    now() + interval '15 days',
    'verified',
    now(),
    actor_id,
    'Identidade confirmada no ensaio transacional.'
  from public.profiles profile
  where profile.id = target_profile_id
  returning id into correction_id;

  insert into public.site_feedback(
    protocol,
    public_request_key,
    profile_id,
    category,
    customer_name,
    customer_email,
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
    'PRIV-CONS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
    gen_random_uuid(),
    profile.id,
    'privacy',
    profile.full_name,
    profile.email,
    'https://homologacao-adoce--adoce-homologacao.netlify.app/#operacao',
    'Solicitação temporária para validar revogação de marketing com rollback.',
    'consent',
    now() + interval '15 days',
    'verified',
    now(),
    actor_id,
    'Identidade confirmada no ensaio transacional.'
  from public.profiles profile
  where profile.id = target_profile_id
  returning id into consent_id;

  perform set_config('request.jwt.claim.sub', actor_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', actor_id, 'role', 'authenticated')::text,
    true
  );

  correction_result := public.staff_apply_privacy_name_correction(
    correction_id,
    '  MARIA   DA   SILVA  '
  );

  select profile.full_name
  into corrected_name
  from public.profiles profile
  where profile.id = target_profile_id;

  if corrected_name is distinct from 'Maria da Silva' then
    raise exception 'Nome não foi normalizado corretamente: %', corrected_name;
  end if;
  if correction_result->>'status' is distinct from 'resolved'
     or correction_result->>'privacy_action_type' is distinct from 'correction' then
    raise exception 'Solicitação de correção não foi resolvida corretamente';
  end if;

  consent_result := public.staff_apply_privacy_consent_change(
    consent_id,
    false,
    true,
    true
  );

  select event.granted
  into latest_marketing
  from public.consent_events event
  where event.profile_id = target_profile_id
    and event.consent_type::text = 'marketing'
  order by event.created_at desc
  limit 1;

  select preference.*
  into preference_record
  from public.notification_preferences preference
  where preference.profile_id = target_profile_id;

  if latest_marketing is distinct from false then
    raise exception 'Revogação de marketing não foi registrada';
  end if;
  if preference_record.whatsapp_enabled
     or preference_record.email_enabled
     or preference_record.promotions
     or preference_record.club_news then
    raise exception 'Canais promocionais continuaram ativos após revogação';
  end if;
  if consent_result->>'marketing' is distinct from 'false'
     or consent_result->>'whatsapp' is distinct from 'false'
     or consent_result->>'email' is distinct from 'false' then
    raise exception 'Resposta do consentimento não refletiu a revogação';
  end if;

  select exists(
    select 1
    from public.audit_events event
    where event.action = 'privacy_request.profile_name_corrected'
      and event.payload->>'feedback_id' = correction_id::text
  ) into correction_audit;

  select exists(
    select 1
    from public.audit_events event
    where event.action = 'privacy_request.marketing_consent_changed'
      and event.payload->>'feedback_id' = consent_id::text
  ) into consent_audit;

  if not correction_audit or not consent_audit then
    raise exception 'Auditoria de correção ou consentimento não foi registrada';
  end if;

  if has_function_privilege(
    'anon',
    'public.staff_apply_privacy_name_correction(uuid,text)'::regprocedure,
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.staff_apply_privacy_consent_change(uuid,boolean,boolean,boolean)'::regprocedure,
    'EXECUTE'
  ) then
    raise exception 'RPC de correção ou consentimento exposto ao anônimo';
  end if;
end;
$$;

rollback;
