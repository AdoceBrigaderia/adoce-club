begin;

alter table public.site_feedback
  drop constraint if exists site_feedback_privacy_action_check;

alter table public.site_feedback
  add constraint site_feedback_privacy_action_check
  check (
    (
      category = 'privacy'
      and (
        privacy_action_type is null
        or privacy_action_type in ('correction', 'consent', 'deletion')
      )
      and char_length(coalesce(privacy_action_summary, '')) <= 1200
    )
    or
    (
      category <> 'privacy'
      and privacy_action_applied_at is null
      and privacy_action_applied_by is null
      and privacy_action_type is null
      and privacy_action_summary is null
    )
  ) not valid;

alter table public.site_feedback
  validate constraint site_feedback_privacy_action_check;

create or replace function public.staff_get_privacy_anonymization_plan(
  target_feedback_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  request_row public.site_feedback%rowtype;
  profile_row public.profiles%rowtype;
  normalized_phone text;
  staff_count integer := 0;
  open_order_count integer := 0;
  open_service_count integer := 0;
  shared_account_count integer := 0;
  account_count integer := 0;
  order_count integer := 0;
  service_count integer := 0;
  checkin_count integer := 0;
  available_reward_count integer := 0;
begin
  if actor_user_id is null or private.current_staff_role()::text <> 'owner' then
    raise exception 'Somente o proprietário pode avaliar exclusão ou anonimização';
  end if;

  select feedback.*
  into request_row
  from public.site_feedback feedback
  where feedback.id = target_feedback_id
    and feedback.category = 'privacy';

  if request_row.id is null or request_row.privacy_request_type <> 'deletion' then
    raise exception 'Solicitação de exclusão ou anonimização não encontrada';
  end if;
  if coalesce(request_row.privacy_identity_status, 'pending') <> 'verified' then
    raise exception 'Confirme a identidade antes de avaliar a anonimização';
  end if;
  if request_row.profile_id is null then
    raise exception 'Vincule a solicitação ao cadastro correto';
  end if;

  select profile.* into profile_row
  from public.profiles profile
  where profile.id = request_row.profile_id;

  if profile_row.id is null then
    raise exception 'Cadastro vinculado não encontrado';
  end if;

  normalized_phone := regexp_replace(coalesce(profile_row.phone_e164, ''), '[^0-9]', '', 'g');

  select count(*)::integer into staff_count
  from public.staff_members member
  where member.user_id = profile_row.id;

  select count(*)::integer into open_order_count
  from public.instant_orders customer_order
  where (
      customer_order.profile_id = profile_row.id
      or (
        normalized_phone <> ''
        and regexp_replace(coalesce(customer_order.customer_phone, ''), '[^0-9]', '', 'g') = normalized_phone
      )
    )
    and customer_order.status not in ('completed', 'cancelled', 'expired');

  select count(*)::integer into open_service_count
  from public.service_requests request_item
  where (
      request_item.profile_id = profile_row.id
      or (
        normalized_phone <> ''
        and regexp_replace(coalesce(request_item.customer_phone, ''), '[^0-9]', '', 'g') = normalized_phone
      )
    )
    and request_item.status not in ('completed', 'cancelled', 'expired');

  select count(distinct membership.account_id)::integer into account_count
  from public.account_memberships membership
  where membership.profile_id = profile_row.id;

  select count(distinct membership.account_id)::integer into shared_account_count
  from public.account_memberships membership
  where membership.profile_id = profile_row.id
    and exists (
      select 1
      from public.account_memberships other_member
      where other_member.account_id = membership.account_id
        and other_member.profile_id <> profile_row.id
        and other_member.active
    );

  select count(*)::integer into order_count
  from public.instant_orders customer_order
  where customer_order.profile_id = profile_row.id
     or (
       normalized_phone <> ''
       and regexp_replace(coalesce(customer_order.customer_phone, ''), '[^0-9]', '', 'g') = normalized_phone
     );

  select count(*)::integer into service_count
  from public.service_requests request_item
  where request_item.profile_id = profile_row.id
     or (
       normalized_phone <> ''
       and regexp_replace(coalesce(request_item.customer_phone, ''), '[^0-9]', '', 'g') = normalized_phone
     );

  select count(*)::integer into checkin_count
  from public.customer_checkins checkin
  where checkin.profile_id = profile_row.id;

  select count(*)::integer into available_reward_count
  from public.rewards reward
  join public.loyalty_tracks track on track.id = reward.track_id
  join public.account_memberships membership on membership.account_id = track.account_id
  where membership.profile_id = profile_row.id
    and reward.status::text = 'available';

  return jsonb_build_object(
    'id', request_row.id,
    'protocol', request_row.protocol,
    'profile_id', profile_row.id,
    'profile_name', profile_row.full_name,
    'ready', staff_count = 0 and open_order_count = 0 and open_service_count = 0 and shared_account_count = 0,
    'blockers', jsonb_build_object(
      'staff_profile', staff_count > 0,
      'open_orders', open_order_count,
      'open_service_requests', open_service_count,
      'shared_loyalty_accounts', shared_account_count
    ),
    'impact', jsonb_build_object(
      'loyalty_accounts', account_count,
      'available_rewards_to_reverse', available_reward_count,
      'orders_to_anonymize', order_count,
      'service_requests_to_anonymize', service_count,
      'checkins_to_remove', checkin_count
    ),
    'confirmation_required', request_row.protocol
  );
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
  actor_user_id uuid := (select auth.uid());
  request_row public.site_feedback%rowtype;
  profile_row public.profiles%rowtype;
  normalized_phone text;
  anonymous_email text;
  anonymous_member_code text;
  affected_orders integer := 0;
  affected_services integer := 0;
  removed_checkins integer := 0;
  removed_crm_records integer := 0;
  reversed_rewards integer := 0;
  attempt integer := 0;
  plan jsonb;
begin
  if actor_user_id is null or private.current_staff_role()::text <> 'owner' then
    raise exception 'Somente o proprietário pode executar anonimização';
  end if;

  select feedback.*
  into request_row
  from public.site_feedback feedback
  where feedback.id = target_feedback_id
    and feedback.category = 'privacy'
  for update;

  if request_row.id is null or request_row.privacy_request_type <> 'deletion' then
    raise exception 'Solicitação de exclusão ou anonimização não encontrada';
  end if;
  if btrim(coalesce(requested_confirmation, '')) is distinct from request_row.protocol then
    raise exception 'Digite o protocolo exato para confirmar a anonimização';
  end if;
  if coalesce(request_row.privacy_identity_status, 'pending') <> 'verified' then
    raise exception 'Confirme a identidade antes de executar a anonimização';
  end if;
  if request_row.profile_id is null then
    raise exception 'Vincule a solicitação ao cadastro correto';
  end if;

  select profile.* into profile_row
  from public.profiles profile
  where profile.id = request_row.profile_id
  for update;

  if profile_row.id is null then
    raise exception 'Cadastro vinculado não encontrado';
  end if;
  if profile_row.account_status = 'anonymized' then
    raise exception 'Este cadastro já foi anonimizado';
  end if;

  plan := public.staff_get_privacy_anonymization_plan(target_feedback_id);
  if not coalesce((plan->>'ready')::boolean, false) then
    raise exception 'Resolva os bloqueios do plano antes de anonimizar o cadastro';
  end if;

  normalized_phone := regexp_replace(coalesce(profile_row.phone_e164, ''), '[^0-9]', '', 'g');
  anonymous_email := 'deleted+' || replace(profile_row.id::text, '-', '') || '@users.invalid';

  loop
    attempt := attempt + 1;
    anonymous_member_code := format(
      'ADOC %s %s %s',
      lpad(floor(random() * 10000)::integer::text, 4, '0'),
      lpad(floor(random() * 10000)::integer::text, 4, '0'),
      lpad(floor(random() * 10000)::integer::text, 4, '0')
    );
    exit when not exists (
      select 1 from public.profiles existing
      where existing.member_code = anonymous_member_code
        and existing.id <> profile_row.id
    );
    if attempt >= 20 then
      raise exception 'Não foi possível gerar identificador anonimizado único';
    end if;
  end loop;

  update public.rewards reward
  set status = 'reversed',
      reversed_at = coalesce(reward.reversed_at, now())
  from public.loyalty_tracks track
  join public.account_memberships membership on membership.account_id = track.account_id
  where reward.track_id = track.id
    and membership.profile_id = profile_row.id
    and reward.status::text = 'available';
  get diagnostics reversed_rewards = row_count;

  update public.account_memberships
  set active = false,
      is_primary = false
  where profile_id = profile_row.id;

  update public.loyalty_accounts account
  set active = false,
      name = 'Conta Anonimizada',
      updated_at = now()
  where account.owner_profile_id = profile_row.id;

  delete from public.customer_qr_tokens where profile_id = profile_row.id;
  update public.customer_wallet_passes
  set status = 'revoked', revoked_at = coalesce(revoked_at, now()), metadata = '{}'::jsonb
  where profile_id = profile_row.id;
  update public.wallet_passes
  set status = 'revoked', last_synced_at = now()
  where profile_id = profile_row.id;

  delete from public.customer_checkins where profile_id = profile_row.id;
  get diagnostics removed_checkins = row_count;

  delete from public.customer_crm_notes where profile_id = profile_row.id;
  get diagnostics removed_crm_records = row_count;
  delete from public.customer_crm_tags where profile_id = profile_row.id;
  delete from public.crm_notes where profile_id = profile_row.id;
  delete from public.crm_tasks where profile_id = profile_row.id;
  delete from public.notification_preferences where profile_id = profile_row.id;
  delete from public.referral_codes where profile_id = profile_row.id;

  delete from public.whatsapp_verification_challenges where profile_id = profile_row.id;
  delete from public.whatsapp_auth_challenges
  where profile_id = profile_row.id
     or (
       normalized_phone <> ''
       and regexp_replace(coalesce(phone_e164, ''), '[^0-9]', '', 'g') = normalized_phone
     );

  update public.instant_orders customer_order
  set profile_id = null,
      customer_name = 'Cliente Anonimizado',
      customer_phone = '+5500000000000',
      customer_notes = '',
      internal_notes = '',
      updated_at = now()
  where customer_order.profile_id = profile_row.id
     or (
       normalized_phone <> ''
       and regexp_replace(coalesce(customer_order.customer_phone, ''), '[^0-9]', '', 'g') = normalized_phone
     );
  get diagnostics affected_orders = row_count;

  update public.service_requests request_item
  set profile_id = null,
      customer_name = 'Cliente Anonimizado',
      customer_phone = '+5500000000000',
      customer_email = null,
      customer_notes = '',
      internal_notes = '',
      updated_at = now()
  where request_item.profile_id = profile_row.id
     or (
       normalized_phone <> ''
       and regexp_replace(coalesce(request_item.customer_phone, ''), '[^0-9]', '', 'g') = normalized_phone
     );
  get diagnostics affected_services = row_count;

  update public.site_feedback feedback
  set profile_id = null,
      customer_name = 'Cliente Anonimizado',
      customer_email = null,
      customer_phone = null,
      message = case
        when feedback.id = request_row.id then 'Solicitação de anonimização concluída.'
        else 'Conteúdo removido por anonimização do cadastro.'
      end,
      internal_notes = '',
      privacy_identity_notes = null,
      privacy_response_delivery_notes = null,
      updated_at = now()
  where feedback.profile_id = profile_row.id
     or (
       normalized_phone <> ''
       and regexp_replace(coalesce(feedback.customer_phone, ''), '[^0-9]', '', 'g') = normalized_phone
     )
     or lower(coalesce(feedback.customer_email, '')) = lower(coalesce(profile_row.email, ''));

  delete from auth.refresh_tokens where user_id = profile_row.id::text;
  delete from auth.sessions where user_id = profile_row.id;
  delete from auth.webauthn_challenges where user_id = profile_row.id;
  delete from auth.webauthn_credentials where user_id = profile_row.id;

  update auth.identities identity_row
  set provider_id = 'deleted-' || replace(profile_row.id::text, '-', '') || '-' || identity_row.provider,
      email = anonymous_email,
      identity_data = jsonb_build_object(
        'sub', profile_row.id::text,
        'email', anonymous_email,
        'anonymized', true
      ),
      updated_at = now()
  where identity_row.user_id = profile_row.id;

  update auth.users
  set email = anonymous_email,
      phone = null,
      encrypted_password = '!' || md5(gen_random_uuid()::text),
      raw_user_meta_data = jsonb_build_object('anonymized', true),
      raw_app_meta_data = '{}'::jsonb,
      confirmation_token = '',
      recovery_token = '',
      email_change_token_new = '',
      email_change_token_current = '',
      phone_change_token = '',
      reauthentication_token = '',
      banned_until = 'infinity'::timestamptz,
      deleted_at = now(),
      updated_at = now()
  where id = profile_row.id;

  update public.profiles
  set full_name = 'Cliente Anonimizado',
      phone_e164 = null,
      email = null,
      active = false,
      birth_date = null,
      preferred_channel = 'none',
      postal_code = null,
      address_line = null,
      address_number = null,
      address_complement = null,
      neighborhood = null,
      city = null,
      state_code = null,
      flavor_preferences = '{}'::text[],
      member_code = anonymous_member_code,
      whatsapp_verified_at = null,
      account_status = 'anonymized',
      status_reason_code = 'privacy_anonymization',
      status_reason_note = null,
      status_changed_at = now(),
      status_changed_by = actor_user_id,
      must_change_password = false,
      temporary_password_issued_at = null,
      temporary_password_expires_at = null,
      updated_at = now()
  where id = profile_row.id;

  update public.site_feedback
  set privacy_action_applied_at = now(),
      privacy_action_applied_by = actor_user_id,
      privacy_action_type = 'deletion',
      privacy_action_summary = 'Cadastro anonimizado; registros financeiros e de auditoria foram preservados sem contato direto.',
      status = 'resolved',
      privacy_resolved_at = coalesce(privacy_resolved_at, now()),
      profile_id = null,
      updated_at = now()
  where id = request_row.id;

  insert into public.audit_events(
    actor_user_id,
    action,
    entity_type,
    entity_id,
    payload
  ) values (
    actor_user_id,
    'privacy_request.profile_anonymized',
    'profile',
    profile_row.id::text,
    jsonb_build_object(
      'feedback_id', request_row.id,
      'protocol', request_row.protocol,
      'orders_anonymized', affected_orders,
      'service_requests_anonymized', affected_services,
      'checkins_removed', removed_checkins,
      'crm_records_removed', removed_crm_records,
      'rewards_reversed', reversed_rewards,
      'auth_sessions_revoked', true
    )
  );

  return jsonb_build_object(
    'id', request_row.id,
    'protocol', request_row.protocol,
    'profile_id', profile_row.id,
    'status', 'resolved',
    'account_status', 'anonymized',
    'privacy_action_type', 'deletion',
    'privacy_action_applied_at', now(),
    'orders_anonymized', affected_orders,
    'service_requests_anonymized', affected_services,
    'checkins_removed', removed_checkins,
    'rewards_reversed', reversed_rewards
  );
end;
$$;

revoke all on function public.staff_get_privacy_anonymization_plan(uuid)
  from public, anon;
grant execute on function public.staff_get_privacy_anonymization_plan(uuid)
  to authenticated;

revoke all on function public.staff_anonymize_privacy_profile(uuid,text)
  from public, anon;
grant execute on function public.staff_anonymize_privacy_profile(uuid,text)
  to authenticated;

commit;
