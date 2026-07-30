begin;

alter table public.site_feedback
  add column if not exists privacy_response_prepared_at timestamptz,
  add column if not exists privacy_response_prepared_by uuid,
  add column if not exists privacy_response_package_version text,
  add column if not exists privacy_response_delivered_at timestamptz,
  add column if not exists privacy_response_delivered_by uuid,
  add column if not exists privacy_response_delivery_channel text,
  add column if not exists privacy_response_delivery_notes text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'site_feedback_privacy_response_check'
      and conrelid = 'public.site_feedback'::regclass
  ) then
    alter table public.site_feedback
      add constraint site_feedback_privacy_response_check
      check (
        (
          category = 'privacy'
          and (
            privacy_response_delivery_channel is null
            or privacy_response_delivery_channel in ('email', 'whatsapp', 'in_person', 'other')
          )
          and char_length(coalesce(privacy_response_delivery_notes, '')) <= 1200
          and char_length(coalesce(privacy_response_package_version, '')) <= 40
        )
        or
        (
          category <> 'privacy'
          and privacy_response_prepared_at is null
          and privacy_response_prepared_by is null
          and privacy_response_package_version is null
          and privacy_response_delivered_at is null
          and privacy_response_delivered_by is null
          and privacy_response_delivery_channel is null
          and privacy_response_delivery_notes is null
        )
      ) not valid;
  end if;
end;
$$;

alter table public.site_feedback
  validate constraint site_feedback_privacy_response_check;

create index if not exists site_feedback_privacy_response_pending_delivery_idx
  on public.site_feedback (privacy_response_prepared_at, privacy_due_at, created_at)
  where category = 'privacy'
    and privacy_request_type = 'access'
    and privacy_response_prepared_at is not null
    and privacy_response_delivered_at is null
    and status not in ('closed');

create or replace function public.staff_prepare_privacy_access_response(
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
  target_account_id uuid;
  main_track public.loyalty_tracks%rowtype;
  referral_track public.loyalty_tracks%rowtype;
  normalized_phone text;
  package_version constant text := '2026-07-27.1';
  package jsonb;
  movement_count integer := 0;
  order_count integer := 0;
  checkin_count integer := 0;
begin
  if actor_user_id is null
     or not private.staff_has_any_capability('manage_customers') then
    raise exception 'Acesso à preparação da resposta de privacidade não autorizado';
  end if;

  if target_feedback_id is null then
    raise exception 'Selecione uma solicitação de privacidade';
  end if;

  select feedback.*
  into request_row
  from public.site_feedback feedback
  where feedback.id = target_feedback_id
    and feedback.category = 'privacy'
  for update;

  if request_row.id is null then
    raise exception 'Solicitação de privacidade não encontrada';
  end if;
  if request_row.privacy_request_type <> 'access' then
    raise exception 'Este pacote é exclusivo para solicitações de consulta de dados';
  end if;
  if coalesce(request_row.privacy_identity_status, 'pending') <> 'verified' then
    raise exception 'Confirme a identidade do solicitante antes de preparar os dados';
  end if;
  if request_row.profile_id is null then
    raise exception 'Vincule a solicitação ao cadastro correto antes de preparar os dados';
  end if;

  select profile.*
  into profile_row
  from public.profiles profile
  where profile.id = request_row.profile_id
  for share;

  if profile_row.id is null then
    raise exception 'Cadastro vinculado não encontrado';
  end if;

  normalized_phone := regexp_replace(coalesce(profile_row.phone_e164, ''), '[^0-9]', '', 'g');

  select membership.account_id
  into target_account_id
  from public.account_memberships membership
  where membership.profile_id = profile_row.id
    and membership.active
  order by membership.is_primary desc, membership.created_at
  limit 1;

  if target_account_id is not null then
    select track.* into main_track
    from public.loyalty_tracks track
    where track.account_id = target_account_id
      and track.kind::text = 'main'
    limit 1;

    select track.* into referral_track
    from public.loyalty_tracks track
    where track.account_id = target_account_id
      and track.kind::text = 'referral'
    limit 1;
  end if;

  select count(*)::integer
  into movement_count
  from public.ledger_entries ledger
  where ledger.track_id in (main_track.id, referral_track.id);

  select count(*)::integer
  into order_count
  from public.instant_orders customer_order
  where normalized_phone <> ''
    and regexp_replace(coalesce(customer_order.customer_phone, ''), '[^0-9]', '', 'g') = normalized_phone;

  select count(*)::integer
  into checkin_count
  from public.customer_checkins checkin
  where checkin.profile_id = profile_row.id;

  package := jsonb_build_object(
    'metadata', jsonb_build_object(
      'protocol', request_row.protocol,
      'package_version', package_version,
      'generated_at', now(),
      'scope', 'Dados pessoais e registros operacionais vinculados ao cadastro identificado no Portal Adoce',
      'notice', 'Anotações internas, controles antifraude, segredos técnicos e dados de terceiros não integram este pacote.'
    ),
    'profile', jsonb_build_object(
      'id', profile_row.id,
      'full_name', profile_row.full_name,
      'member_code', profile_row.member_code,
      'phone_e164', profile_row.phone_e164,
      'email', profile_row.email,
      'active', profile_row.active,
      'account_status', profile_row.account_status::text,
      'whatsapp_verified', profile_row.whatsapp_verified_at is not null,
      'created_at', profile_row.created_at,
      'updated_at', profile_row.updated_at
    ),
    'consents', coalesce((
      select jsonb_agg(to_jsonb(consent_row) order by consent_row.created_at desc)
      from (
        select
          event.consent_type::text as consent_type,
          event.granted,
          event.source,
          event.created_at
        from public.consent_events event
        where event.profile_id = profile_row.id
        order by event.created_at desc
        limit 100
      ) consent_row
    ), '[]'::jsonb),
    'preferences', coalesce((
      select to_jsonb(preference) - 'profile_id'
      from public.notification_preferences preference
      where preference.profile_id = profile_row.id
      limit 1
    ), '{}'::jsonb),
    'loyalty', jsonb_build_object(
      'current_progress', coalesce(main_track.current_progress, 0),
      'completed_cards', coalesce(main_track.completed_cards, 0),
      'available_rewards', coalesce((
        select count(*)::integer
        from public.rewards reward
        where reward.track_id = main_track.id
          and reward.status::text = 'available'
      ), 0),
      'referral_progress', coalesce(referral_track.current_progress, 0),
      'referral_completed_cards', coalesce(referral_track.completed_cards, 0),
      'movement_count', movement_count,
      'recent_movements', coalesce((
        select jsonb_agg(to_jsonb(movement_row) order by movement_row.created_at desc)
        from (
          select
            ledger.reason::text as reason,
            ledger.stamps_delta,
            ledger.resulting_progress,
            ledger.resulting_completed_cards,
            ledger.created_at
          from public.ledger_entries ledger
          where ledger.track_id in (main_track.id, referral_track.id)
          order by ledger.created_at desc
          limit 100
        ) movement_row
      ), '[]'::jsonb)
    ),
    'orders', jsonb_build_object(
      'total_count', order_count,
      'recent', coalesce((
        select jsonb_agg(to_jsonb(order_row) order by order_row.created_at desc)
        from (
          select
            customer_order.order_number,
            customer_order.status::text as status,
            customer_order.payment_status::text as payment_status,
            customer_order.total,
            customer_order.payment_method_label,
            customer_order.sales_channel,
            customer_order.pickup_label,
            customer_order.created_at
          from public.instant_orders customer_order
          where normalized_phone <> ''
            and regexp_replace(coalesce(customer_order.customer_phone, ''), '[^0-9]', '', 'g') = normalized_phone
          order by customer_order.created_at desc
          limit 100
        ) order_row
      ), '[]'::jsonb)
    ),
    'checkins', jsonb_build_object(
      'total_count', checkin_count,
      'recent', coalesce((
        select jsonb_agg(to_jsonb(checkin_row) order by checkin_row.created_at desc)
        from (
          select
            store_row.name as store_name,
            checkin.status,
            checkin.created_at,
            checkin.claimed_at,
            checkin.expires_at
          from public.customer_checkins checkin
          join public.stores store_row on store_row.id = checkin.store_id
          where checkin.profile_id = profile_row.id
          order by checkin.created_at desc
          limit 100
        ) checkin_row
      ), '[]'::jsonb)
    )
  );

  update public.site_feedback
  set privacy_response_prepared_at = now(),
      privacy_response_prepared_by = actor_user_id,
      privacy_response_package_version = package_version,
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
    'privacy_request.access_package_prepared',
    'site_feedback',
    request_row.id::text,
    jsonb_build_object(
      'protocol', request_row.protocol,
      'profile_id', profile_row.id,
      'package_version', package_version,
      'movement_count', movement_count,
      'order_count', order_count,
      'checkin_count', checkin_count
    )
  );

  return package;
end;
$$;

create or replace function public.staff_mark_privacy_response_delivered(
  target_feedback_id uuid,
  requested_channel text,
  requested_delivery_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  request_row public.site_feedback%rowtype;
  updated_row public.site_feedback%rowtype;
  normalized_channel text := lower(btrim(coalesce(requested_channel, '')));
  normalized_notes text := btrim(coalesce(requested_delivery_notes, ''));
begin
  if actor_user_id is null
     or not private.staff_has_any_capability('manage_customers') then
    raise exception 'Acesso ao registro de entrega não autorizado';
  end if;

  if normalized_channel not in ('email', 'whatsapp', 'in_person', 'other') then
    raise exception 'Canal de entrega inválido';
  end if;
  if char_length(normalized_notes) > 1200 then
    raise exception 'A anotação da entrega deve ter no máximo 1200 caracteres';
  end if;

  select feedback.*
  into request_row
  from public.site_feedback feedback
  where feedback.id = target_feedback_id
    and feedback.category = 'privacy'
  for update;

  if request_row.id is null then
    raise exception 'Solicitação de privacidade não encontrada';
  end if;
  if request_row.privacy_request_type <> 'access' then
    raise exception 'O registro de pacote é exclusivo para consulta de dados';
  end if;
  if coalesce(request_row.privacy_identity_status, 'pending') <> 'verified' then
    raise exception 'A identidade precisa estar confirmada';
  end if;
  if request_row.privacy_response_prepared_at is null then
    raise exception 'Prepare o pacote de dados antes de registrar a entrega';
  end if;

  update public.site_feedback
  set privacy_response_delivered_at = now(),
      privacy_response_delivered_by = actor_user_id,
      privacy_response_delivery_channel = normalized_channel,
      privacy_response_delivery_notes = nullif(normalized_notes, ''),
      status = 'resolved',
      privacy_resolved_at = coalesce(privacy_resolved_at, now()),
      updated_at = now()
  where id = request_row.id
  returning * into updated_row;

  insert into public.audit_events(
    actor_user_id,
    action,
    entity_type,
    entity_id,
    payload
  ) values (
    actor_user_id,
    'privacy_request.response_delivered',
    'site_feedback',
    request_row.id::text,
    jsonb_build_object(
      'protocol', request_row.protocol,
      'channel', normalized_channel,
      'package_version', request_row.privacy_response_package_version,
      'delivered_at', updated_row.privacy_response_delivered_at
    )
  );

  return jsonb_build_object(
    'id', updated_row.id,
    'protocol', updated_row.protocol,
    'status', updated_row.status,
    'privacy_response_prepared_at', updated_row.privacy_response_prepared_at,
    'privacy_response_package_version', updated_row.privacy_response_package_version,
    'privacy_response_delivered_at', updated_row.privacy_response_delivered_at,
    'privacy_response_delivery_channel', updated_row.privacy_response_delivery_channel,
    'privacy_resolved_at', updated_row.privacy_resolved_at,
    'updated_at', updated_row.updated_at
  );
end;
$$;

revoke all on function public.staff_prepare_privacy_access_response(uuid)
  from public, anon;
grant execute on function public.staff_prepare_privacy_access_response(uuid)
  to authenticated;

revoke all on function public.staff_mark_privacy_response_delivered(uuid,text,text)
  from public, anon;
grant execute on function public.staff_mark_privacy_response_delivered(uuid,text,text)
  to authenticated;

commit;
