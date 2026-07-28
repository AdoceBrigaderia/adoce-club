begin;

create table if not exists public.customer_checkins (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  account_id uuid not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  register_id uuid references public.cash_registers(id) on delete set null,
  status text not null default 'waiting' check (status in ('waiting', 'claimed', 'expired', 'cancelled')),
  operation_key text not null unique check (char_length(operation_key) between 12 and 180),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 minutes'),
  claimed_at timestamptz,
  claimed_by uuid references auth.users(id) on delete set null,
  claim_operation_key text unique,
  claim_result jsonb,
  metadata jsonb not null default '{}'::jsonb,
  check (
    (status = 'claimed' and claimed_at is not null and claimed_by is not null)
    or (status <> 'claimed')
  )
);

create index if not exists customer_checkins_waiting_store_idx
  on public.customer_checkins(store_id, created_at desc)
  where status = 'waiting';
create index if not exists customer_checkins_profile_created_idx
  on public.customer_checkins(profile_id, created_at desc);
create unique index if not exists customer_checkins_one_waiting_profile_store
  on public.customer_checkins(profile_id, store_id)
  where status = 'waiting';

create or replace function public.customer_create_store_checkin(
  store_slug text,
  register_code text default null,
  operation_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  customer_profile_id uuid := (select auth.uid());
  customer_account_id uuid;
  target_store public.stores%rowtype;
  target_register public.cash_registers%rowtype;
  existing public.customer_checkins%rowtype;
  created public.customer_checkins%rowtype;
begin
  if customer_profile_id is null then
    raise exception 'Entre no Clube Adoce para fazer o check-in';
  end if;
  if operation_key is null or char_length(operation_key) < 12 or char_length(operation_key) > 180 then
    raise exception 'Identificador de check-in invalido';
  end if;

  select membership.account_id into customer_account_id
  from public.account_memberships membership
  where membership.profile_id = customer_profile_id
    and membership.active
    and exists (
      select 1 from public.loyalty_tracks track
      where track.account_id = membership.account_id and track.kind = 'main'
    )
  order by membership.account_id
  limit 1;
  if customer_account_id is null then
    raise exception 'Cartao principal do Clube nao encontrado';
  end if;

  select * into target_store
  from public.stores store_row
  where store_row.slug = lower(trim(store_slug)) and store_row.active
  limit 1;
  if target_store.id is null then raise exception 'Loja de check-in nao encontrada'; end if;

  if nullif(trim(coalesce(register_code, '')), '') is not null then
    select * into target_register
    from public.cash_registers register_row
    where register_row.store_id = target_store.id
      and register_row.code = lower(trim(register_code))
      and register_row.active
    limit 1;
    if target_register.id is null then raise exception 'Caixa de check-in nao encontrado'; end if;
  end if;

  update public.customer_checkins
  set status = 'expired'
  where status = 'waiting' and expires_at <= now();

  select * into existing
  from public.customer_checkins checkin
  where checkin.operation_key = customer_create_store_checkin.operation_key;
  if existing.id is not null then
    return jsonb_build_object(
      'checkin_id', existing.id,
      'status', existing.status,
      'expires_at', existing.expires_at,
      'store_name', target_store.public_label,
      'duplicate', true
    );
  end if;

  update public.customer_checkins
  set status = 'cancelled'
  where profile_id = customer_profile_id
    and store_id = target_store.id
    and status = 'waiting';

  insert into public.customer_checkins(
    profile_id, account_id, store_id, register_id, operation_key, metadata
  ) values (
    customer_profile_id,
    customer_account_id,
    target_store.id,
    target_register.id,
    customer_create_store_checkin.operation_key,
    jsonb_build_object(
      'source', 'nfc_qr_store_tag',
      'store_slug', target_store.slug,
      'register_code', target_register.code
    )
  ) returning * into created;

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values (
    customer_profile_id,
    'customer.checkin_created',
    'customer_checkin',
    created.id::text,
    jsonb_build_object('store_id', created.store_id, 'register_id', created.register_id, 'expires_at', created.expires_at)
  );

  return jsonb_build_object(
    'checkin_id', created.id,
    'status', created.status,
    'expires_at', created.expires_at,
    'store_name', coalesce(nullif(target_store.public_label, ''), target_store.name),
    'duplicate', false
  );
exception when unique_violation then
  select * into existing
  from public.customer_checkins checkin
  where checkin.profile_id = customer_profile_id
    and checkin.store_id = target_store.id
    and checkin.status = 'waiting'
  order by checkin.created_at desc
  limit 1;
  if existing.id is not null then
    return jsonb_build_object(
      'checkin_id', existing.id,
      'status', existing.status,
      'expires_at', existing.expires_at,
      'store_name', coalesce(nullif(target_store.public_label, ''), target_store.name),
      'duplicate', true
    );
  end if;
  raise;
end;
$$;

create or replace function public.staff_list_active_customer_checkins(
  target_store_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.is_staff() then
    raise exception 'Acesso nao autorizado';
  end if;

  update public.customer_checkins
  set status = 'expired'
  where status = 'waiting' and expires_at <= now();

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'checkin_id', checkin.id,
      'profile_id', checkin.profile_id,
      'account_id', checkin.account_id,
      'store_id', checkin.store_id,
      'register_id', checkin.register_id,
      'full_name', profile.full_name,
      'phone_e164', profile.phone_e164,
      'member_code', profile.member_code,
      'created_at', checkin.created_at,
      'expires_at', checkin.expires_at
    ) order by checkin.created_at)
    from public.customer_checkins checkin
    join public.profiles profile on profile.id = checkin.profile_id
    where checkin.status = 'waiting'
      and checkin.expires_at > now()
      and (target_store_id is null or checkin.store_id = target_store_id)
      and private.can_access_store(checkin.store_id)
  ), '[]'::jsonb);
end;
$$;

create or replace function public.staff_apply_customer_checkin_stamps(
  checkin_id uuid,
  stamps_delta smallint,
  adjustment_reason text,
  operation_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  checkin public.customer_checkins%rowtype;
  loyalty_result jsonb;
  final_result jsonb;
begin
  if (select auth.uid()) is null or not private.staff_has_any_capability('manage_loyalty') then
    raise exception 'Voce nao possui permissao para atender este check-in';
  end if;
  if operation_key is null or char_length(operation_key) < 12 or char_length(operation_key) > 180 then
    raise exception 'Chave de idempotencia invalida';
  end if;
  if stamps_delta is null or stamps_delta < 1 or stamps_delta > 50 then
    raise exception 'Informe entre 1 e 50 carimbos';
  end if;

  select * into checkin
  from public.customer_checkins row_checkin
  where row_checkin.id = staff_apply_customer_checkin_stamps.checkin_id
  for update;
  if checkin.id is null then raise exception 'Check-in nao encontrado'; end if;

  if checkin.status = 'claimed' and checkin.claim_operation_key = operation_key then
    return checkin.claim_result;
  end if;
  if checkin.status <> 'waiting' then raise exception 'Este check-in ja foi encerrado'; end if;
  if checkin.expires_at <= now() then
    update public.customer_checkins set status = 'expired' where id = checkin.id;
    raise exception 'Este check-in expirou. Peca ao cliente para encostar novamente';
  end if;
  if not private.can_access_store(checkin.store_id) then
    raise exception 'Voce nao possui acesso a esta loja';
  end if;

  loyalty_result := public.staff_adjust_loyalty_stamps(
    checkin.account_id,
    checkin.profile_id,
    stamps_delta,
    coalesce(nullif(trim(adjustment_reason), ''), 'Check-in NFC ou QR no atendimento'),
    operation_key || ':loyalty'
  );
  final_result := loyalty_result || jsonb_build_object(
    'checkin_id', checkin.id,
    'profile_id', checkin.profile_id,
    'stamps_delta', stamps_delta,
    'claimed', true
  );

  update public.customer_checkins
  set status = 'claimed',
      claimed_at = now(),
      claimed_by = (select auth.uid()),
      claim_operation_key = operation_key,
      claim_result = final_result
  where id = checkin.id;

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values (
    (select auth.uid()),
    'customer.checkin_claimed',
    'customer_checkin',
    checkin.id::text,
    jsonb_build_object('profile_id', checkin.profile_id, 'store_id', checkin.store_id, 'stamps_delta', stamps_delta)
  );

  return final_result;
end;
$$;

alter table public.customer_checkins enable row level security;

revoke all on table public.customer_checkins from public, anon, authenticated;
revoke all on function public.customer_create_store_checkin(text,text,text) from public, anon;
revoke all on function public.staff_list_active_customer_checkins(uuid) from public, anon;
revoke all on function public.staff_apply_customer_checkin_stamps(uuid,smallint,text,text) from public, anon;
grant execute on function public.customer_create_store_checkin(text,text,text) to authenticated;
grant execute on function public.staff_list_active_customer_checkins(uuid) to authenticated;
grant execute on function public.staff_apply_customer_checkin_stamps(uuid,smallint,text,text) to authenticated;

commit;
