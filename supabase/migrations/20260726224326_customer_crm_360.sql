begin;

create table if not exists public.customer_crm_notes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  note_type text not null default 'note' check (note_type in ('note', 'contact', 'preference', 'issue')),
  body text not null check (char_length(btrim(body)) between 3 and 2000),
  pinned boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_crm_tags (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  tag text not null check (char_length(btrim(tag)) between 2 and 40),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (profile_id, tag)
);

create index if not exists customer_crm_notes_profile_created_idx
  on public.customer_crm_notes(profile_id, pinned desc, created_at desc);
create index if not exists customer_crm_tags_profile_idx
  on public.customer_crm_tags(profile_id, created_at desc);

create or replace function public.staff_get_customer_360(target_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_row public.profiles%rowtype;
  target_account_id uuid;
  main_track public.loyalty_tracks%rowtype;
  referral_track public.loyalty_tracks%rowtype;
  normalized_phone text;
begin
  if (select auth.uid()) is null or not private.staff_has_any_capability('manage_customers') then
    raise exception 'Acesso ao CRM de clientes nao autorizado';
  end if;
  if target_profile_id is null then
    raise exception 'Selecione um cliente';
  end if;

  select * into profile_row
  from public.profiles profile
  where profile.id = target_profile_id
  for share;

  if profile_row.id is null then
    raise exception 'Cliente nao encontrado';
  end if;

  normalized_phone := regexp_replace(coalesce(profile_row.phone_e164, ''), '[^0-9]', '', 'g');

  select membership.account_id into target_account_id
  from public.account_memberships membership
  where membership.profile_id = target_profile_id
    and membership.active
  order by membership.is_primary desc, membership.created_at
  limit 1;

  if target_account_id is not null then
    select * into main_track
    from public.loyalty_tracks track
    where track.account_id = target_account_id and track.kind::text = 'main'
    limit 1;

    select * into referral_track
    from public.loyalty_tracks track
    where track.account_id = target_account_id and track.kind::text = 'referral'
    limit 1;
  end if;

  return jsonb_build_object(
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
    'loyalty', jsonb_build_object(
      'account_id', target_account_id,
      'current_progress', coalesce(main_track.current_progress, 0),
      'completed_cards', coalesce(main_track.completed_cards, 0),
      'available_rewards', coalesce((
        select count(*)::integer
        from public.rewards reward
        where reward.track_id = main_track.id and reward.status::text = 'available'
      ), 0),
      'referral_progress', coalesce(referral_track.current_progress, 0),
      'referral_completed_cards', coalesce(referral_track.completed_cards, 0)
    ),
    'summary', jsonb_build_object(
      'orders_count', coalesce((
        select count(*)::integer
        from public.instant_orders customer_order
        where normalized_phone <> ''
          and regexp_replace(coalesce(customer_order.customer_phone, ''), '[^0-9]', '', 'g') = normalized_phone
      ), 0),
      'approved_orders', coalesce((
        select count(*)::integer
        from public.instant_orders customer_order
        where normalized_phone <> ''
          and regexp_replace(coalesce(customer_order.customer_phone, ''), '[^0-9]', '', 'g') = normalized_phone
          and customer_order.payment_status::text = 'approved'
      ), 0),
      'total_spent', coalesce((
        select sum(customer_order.total)
        from public.instant_orders customer_order
        where normalized_phone <> ''
          and regexp_replace(coalesce(customer_order.customer_phone, ''), '[^0-9]', '', 'g') = normalized_phone
          and customer_order.payment_status::text = 'approved'
      ), 0),
      'last_order_at', (
        select max(customer_order.created_at)
        from public.instant_orders customer_order
        where normalized_phone <> ''
          and regexp_replace(coalesce(customer_order.customer_phone, ''), '[^0-9]', '', 'g') = normalized_phone
      ),
      'last_checkin_at', (
        select max(checkin.created_at)
        from public.customer_checkins checkin
        where checkin.profile_id = target_profile_id
      )
    ),
    'consents', coalesce((
      select jsonb_object_agg(latest.consent_type, latest.granted)
      from (
        select distinct on (event.consent_type)
          event.consent_type::text as consent_type,
          event.granted
        from public.consent_events event
        where event.profile_id = target_profile_id
        order by event.consent_type, event.created_at desc
      ) latest
    ), '{}'::jsonb),
    'preferences', coalesce((
      select to_jsonb(preference) - 'profile_id'
      from public.notification_preferences preference
      where preference.profile_id = target_profile_id
      limit 1
    ), '{}'::jsonb),
    'tags', coalesce((
      select jsonb_agg(tag_row.tag order by tag_row.tag)
      from public.customer_crm_tags tag_row
      where tag_row.profile_id = target_profile_id
    ), '[]'::jsonb),
    'notes', coalesce((
      select jsonb_agg(to_jsonb(note_row) order by note_row.pinned desc, note_row.created_at desc)
      from (
        select note.id, note.note_type, note.body, note.pinned, note.created_by, note.created_at, note.updated_at
        from public.customer_crm_notes note
        where note.profile_id = target_profile_id
        order by note.pinned desc, note.created_at desc
        limit 30
      ) note_row
    ), '[]'::jsonb),
    'recent_orders', coalesce((
      select jsonb_agg(to_jsonb(order_row) order by order_row.created_at desc)
      from (
        select
          customer_order.id,
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
        limit 15
      ) order_row
    ), '[]'::jsonb),
    'recent_movements', coalesce((
      select jsonb_agg(to_jsonb(movement_row) order by movement_row.created_at desc)
      from (
        select
          ledger.id,
          ledger.reason::text as reason,
          ledger.stamps_delta,
          ledger.resulting_progress,
          ledger.resulting_completed_cards,
          ledger.created_at
        from public.ledger_entries ledger
        where ledger.track_id in (main_track.id, referral_track.id)
        order by ledger.created_at desc
        limit 20
      ) movement_row
    ), '[]'::jsonb),
    'recent_checkins', coalesce((
      select jsonb_agg(to_jsonb(checkin_row) order by checkin_row.created_at desc)
      from (
        select
          checkin.id,
          checkin.status,
          checkin.store_id,
          store_row.name as store_name,
          checkin.created_at,
          checkin.claimed_at,
          checkin.expires_at
        from public.customer_checkins checkin
        join public.stores store_row on store_row.id = checkin.store_id
        where checkin.profile_id = target_profile_id
        order by checkin.created_at desc
        limit 12
      ) checkin_row
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.staff_add_customer_crm_note(
  target_profile_id uuid,
  requested_type text,
  requested_body text,
  requested_pinned boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  created public.customer_crm_notes%rowtype;
begin
  if (select auth.uid()) is null or not private.staff_has_any_capability('manage_customers') then
    raise exception 'Acesso ao CRM de clientes nao autorizado';
  end if;
  if not exists(select 1 from public.profiles profile where profile.id = target_profile_id) then
    raise exception 'Cliente nao encontrado';
  end if;
  if requested_type not in ('note', 'contact', 'preference', 'issue') then
    raise exception 'Tipo de anotacao invalido';
  end if;
  if char_length(btrim(coalesce(requested_body, ''))) not between 3 and 2000 then
    raise exception 'A anotacao deve ter entre 3 e 2000 caracteres';
  end if;

  insert into public.customer_crm_notes(profile_id, note_type, body, pinned, created_by)
  values (
    target_profile_id,
    requested_type,
    btrim(requested_body),
    coalesce(requested_pinned, false),
    (select auth.uid())
  )
  returning * into created;

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values (
    (select auth.uid()),
    'crm.customer_note_created',
    'customer_crm_note',
    created.id::text,
    jsonb_build_object('profile_id', target_profile_id, 'note_type', created.note_type, 'pinned', created.pinned)
  );

  return to_jsonb(created);
end;
$$;

create or replace function public.staff_set_customer_crm_tag(
  target_profile_id uuid,
  requested_tag text,
  enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_tag text := lower(btrim(coalesce(requested_tag, '')));
begin
  if (select auth.uid()) is null or not private.staff_has_any_capability('manage_customers') then
    raise exception 'Acesso ao CRM de clientes nao autorizado';
  end if;
  if not exists(select 1 from public.profiles profile where profile.id = target_profile_id) then
    raise exception 'Cliente nao encontrado';
  end if;
  if char_length(normalized_tag) not between 2 and 40 then
    raise exception 'A etiqueta deve ter entre 2 e 40 caracteres';
  end if;

  if coalesce(enabled, true) then
    insert into public.customer_crm_tags(profile_id, tag, created_by)
    values (target_profile_id, normalized_tag, (select auth.uid()))
    on conflict (profile_id, tag) do nothing;
  else
    delete from public.customer_crm_tags
    where profile_id = target_profile_id and tag = normalized_tag;
  end if;

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values (
    (select auth.uid()),
    case when coalesce(enabled, true) then 'crm.customer_tag_added' else 'crm.customer_tag_removed' end,
    'customer_profile',
    target_profile_id::text,
    jsonb_build_object('tag', normalized_tag, 'enabled', coalesce(enabled, true))
  );

  return jsonb_build_object('profile_id', target_profile_id, 'tag', normalized_tag, 'enabled', coalesce(enabled, true));
end;
$$;

alter table public.customer_crm_notes enable row level security;
alter table public.customer_crm_tags enable row level security;

revoke all on table public.customer_crm_notes from public, anon, authenticated;
revoke all on table public.customer_crm_tags from public, anon, authenticated;
revoke all on function public.staff_get_customer_360(uuid) from public, anon;
revoke all on function public.staff_add_customer_crm_note(uuid,text,text,boolean) from public, anon;
revoke all on function public.staff_set_customer_crm_tag(uuid,text,boolean) from public, anon;
grant execute on function public.staff_get_customer_360(uuid) to authenticated;
grant execute on function public.staff_add_customer_crm_note(uuid,text,text,boolean) to authenticated;
grant execute on function public.staff_set_customer_crm_tag(uuid,text,boolean) to authenticated;

drop trigger if exists customer_crm_notes_touch_updated_at on public.customer_crm_notes;
create trigger customer_crm_notes_touch_updated_at
before update on public.customer_crm_notes
for each row execute function private.touch_updated_at();

commit;
