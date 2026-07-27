begin;

do $$
declare
  actor_id uuid;
  target_profile_id uuid;
  original_name text;
  original_email text;
  original_phone text;
  feedback_id uuid;
  protocol_value text := 'PRIV-DEL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  plan jsonb;
  result jsonb;
  audit_ok boolean;
  profile_after public.profiles%rowtype;
  auth_email_after text;
  sessions_after integer;
begin
  select member.user_id
  into actor_id
  from public.staff_members member
  where member.active and member.role::text = 'owner'
  order by member.user_id
  limit 1;

  select profile.id, profile.full_name, profile.email, profile.phone_e164
  into target_profile_id, original_name, original_email, original_phone
  from public.profiles profile
  where profile.active
    and profile.email is not null
    and not exists (
      select 1 from public.staff_members staff where staff.user_id = profile.id
    )
    and not exists (
      select 1 from public.instant_orders customer_order
      where customer_order.profile_id = profile.id
        and customer_order.status not in ('completed', 'cancelled', 'expired')
    )
    and not exists (
      select 1 from public.service_requests request_item
      where request_item.profile_id = profile.id
        and request_item.status not in ('completed', 'cancelled', 'expired')
    )
    and not exists (
      select 1
      from public.account_memberships membership
      where membership.profile_id = profile.id
        and exists (
          select 1 from public.account_memberships other_member
          where other_member.account_id = membership.account_id
            and other_member.profile_id <> profile.id
            and other_member.active
        )
    )
  order by profile.created_at
  limit 1;

  if actor_id is null or target_profile_id is null then
    raise exception 'Homologação precisa de owner e cliente elegível para o ensaio';
  end if;

  insert into public.site_feedback(
    protocol, public_request_key, profile_id, category, customer_name,
    customer_email, customer_phone, page_url, message,
    privacy_request_type, privacy_due_at, privacy_identity_status,
    privacy_identity_checked_at, privacy_identity_checked_by,
    privacy_identity_notes
  ) values (
    protocol_value, gen_random_uuid(), target_profile_id, 'privacy', original_name,
    original_email, original_phone,
    'https://homologacao-adoce--adoce-homologacao.netlify.app/#operacao',
    'Solicitação temporária para validar anonimização integral com rollback.',
    'deletion', now() + interval '15 days', 'verified', now(), actor_id,
    'Identidade confirmada no ensaio transacional.'
  ) returning id into feedback_id;

  perform set_config('request.jwt.claim.sub', actor_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', actor_id, 'role', 'authenticated')::text,
    true
  );

  plan := public.staff_get_privacy_anonymization_plan(feedback_id);
  if not coalesce((plan->>'ready')::boolean, false) then
    raise exception 'Plano marcou cliente elegível como bloqueado: %', plan;
  end if;
  if plan->>'confirmation_required' is distinct from protocol_value then
    raise exception 'Plano não exigiu o protocolo exato';
  end if;

  begin
    perform public.staff_anonymize_privacy_profile(feedback_id, 'CONFIRMACAO ERRADA');
    raise exception 'Anonimização aceitou confirmação incorreta';
  exception when others then
    if position('protocolo exato' in sqlerrm) = 0 then
      raise;
    end if;
  end;

  result := public.staff_anonymize_privacy_profile(feedback_id, protocol_value);

  select profile.* into profile_after
  from public.profiles profile
  where profile.id = target_profile_id;

  if profile_after.account_status is distinct from 'anonymized'
     or profile_after.active
     or profile_after.full_name is distinct from 'Cliente Anonimizado'
     or profile_after.email is not null
     or profile_after.phone_e164 is not null
     or profile_after.member_code !~ '^ADOC [0-9]{4} [0-9]{4} [0-9]{4}$' then
    raise exception 'Perfil não foi anonimizado de forma consistente';
  end if;

  select auth_user.email into auth_email_after
  from auth.users auth_user
  where auth_user.id = target_profile_id;

  if auth_email_after not like 'deleted+%@users.invalid' then
    raise exception 'Identidade Auth não foi anonimizada';
  end if;

  select count(*)::integer into sessions_after
  from auth.sessions session_row
  where session_row.user_id = target_profile_id;

  if sessions_after <> 0 then
    raise exception 'Sessões Auth permaneceram após anonimização';
  end if;

  if result->>'status' is distinct from 'resolved'
     or result->>'account_status' is distinct from 'anonymized'
     or result->>'privacy_action_type' is distinct from 'deletion' then
    raise exception 'Resultado não confirmou anonimização e resolução';
  end if;

  select exists(
    select 1 from public.audit_events event
    where event.action = 'privacy_request.profile_anonymized'
      and event.entity_id = target_profile_id::text
      and event.payload->>'feedback_id' = feedback_id::text
  ) into audit_ok;

  if not audit_ok then
    raise exception 'Anonimização não gerou auditoria';
  end if;

  if has_function_privilege(
    'anon',
    'public.staff_get_privacy_anonymization_plan(uuid)'::regprocedure,
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.staff_anonymize_privacy_profile(uuid,text)'::regprocedure,
    'EXECUTE'
  ) then
    raise exception 'RPC de anonimização exposto ao usuário anônimo';
  end if;
end;
$$;

rollback;
