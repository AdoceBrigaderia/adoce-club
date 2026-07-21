-- Pede Junto Adoce: grupos de fatias com pagamento individual e entrega gratuita
-- a partir de cinco fatias. As tabelas permanecem fechadas para acesso direto
-- do cliente; toda entrada publica passa por funcoes com tokens opacos.

alter table public.flavor_availability
  add column if not exists quantity_available integer,
  add column if not exists quantity_reserved integer not null default 0;

alter table public.flavor_availability
  drop constraint if exists flavor_availability_quantity_available_check,
  add constraint flavor_availability_quantity_available_check
    check (quantity_available is null or quantity_available >= 0),
  drop constraint if exists flavor_availability_quantity_reserved_check,
  add constraint flavor_availability_quantity_reserved_check
    check (quantity_reserved >= 0 and (
      quantity_available is null or quantity_reserved <= quantity_available
    ));

create table if not exists public.pede_junto_groups (
  id uuid primary key default gen_random_uuid(),
  public_code text not null unique,
  invitation_token_hash text not null,
  organizer_token_hash text not null,
  name text not null,
  organizer_name text not null,
  organizer_phone text not null,
  delivery_address text not null,
  delivery_reference text,
  minimum_slices integer not null default 5 check (minimum_slices = 5),
  status text not null default 'open' check (status in (
    'open', 'submitted', 'confirmed', 'awaiting_payment', 'preparing',
    'ready', 'completed', 'cancelled', 'expired'
  )),
  closes_at timestamptz not null default (now() + interval '3 hours'),
  free_delivery_unlocked_at timestamptz,
  submitted_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pede_junto_participants (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.pede_junto_groups(id) on delete cascade,
  name text not null,
  phone_e164 text not null,
  participant_token_hash text not null,
  status text not null default 'active' check (status in (
    'active', 'payment_pending', 'paid', 'removed', 'cancelled'
  )),
  payment_url text,
  payment_expires_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, phone_e164)
);

create table if not exists public.pede_junto_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.pede_junto_groups(id) on delete cascade,
  participant_id uuid not null references public.pede_junto_participants(id) on delete cascade,
  flavor_id uuid not null references public.flavors(id),
  flavor_name text not null,
  unit_price numeric(10,2) not null check (unit_price > 0),
  quantity integer not null check (quantity between 1 and 30),
  status text not null default 'selected' check (status in (
    'selected', 'reserved', 'unavailable', 'cancelled', 'paid'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (participant_id, flavor_id)
);

create index if not exists pede_junto_groups_status_idx
  on public.pede_junto_groups(status, created_at desc);
create index if not exists pede_junto_participants_group_idx
  on public.pede_junto_participants(group_id, status);
create index if not exists pede_junto_items_group_idx
  on public.pede_junto_items(group_id, status);
create index if not exists pede_junto_items_flavor_idx
  on public.pede_junto_items(flavor_id, status);

alter table public.pede_junto_groups enable row level security;
alter table public.pede_junto_participants enable row level security;
alter table public.pede_junto_items enable row level security;

revoke all on public.pede_junto_groups from public, anon, authenticated;
revoke all on public.pede_junto_participants from public, anon, authenticated;
revoke all on public.pede_junto_items from public, anon, authenticated;

grant select, insert, update, delete on public.pede_junto_groups to authenticated;
grant select, insert, update, delete on public.pede_junto_participants to authenticated;
grant select, insert, update, delete on public.pede_junto_items to authenticated;
grant all on public.pede_junto_groups, public.pede_junto_participants,
  public.pede_junto_items to service_role;

drop policy if exists pede_junto_groups_staff_all on public.pede_junto_groups;
create policy pede_junto_groups_staff_all
  on public.pede_junto_groups for all to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

drop policy if exists pede_junto_participants_staff_all on public.pede_junto_participants;
create policy pede_junto_participants_staff_all
  on public.pede_junto_participants for all to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

drop policy if exists pede_junto_items_staff_all on public.pede_junto_items;
create policy pede_junto_items_staff_all
  on public.pede_junto_items for all to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

create or replace function private.pede_junto_hash(raw_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(coalesce(raw_token, ''), 'sha256'), 'hex');
$$;

revoke all on function private.pede_junto_hash(text) from public, anon, authenticated;

create or replace function private.pede_junto_room_payload(
  target_group_id uuid,
  viewer_participant_token text default null
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with target as (
    select g.*,
      coalesce(sum(i.quantity) filter (
        where p.status in ('active', 'payment_pending', 'paid')
          and i.status in ('selected', 'reserved', 'paid')
      ), 0)::integer as total_slices,
      coalesce(sum(i.quantity * i.unit_price) filter (
        where p.status in ('active', 'payment_pending', 'paid')
          and i.status in ('selected', 'reserved', 'paid')
      ), 0)::numeric(10,2) as total_value
    from public.pede_junto_groups g
    left join public.pede_junto_participants p on p.group_id = g.id
    left join public.pede_junto_items i on i.participant_id = p.id
    where g.id = target_group_id
    group by g.id
  )
  select jsonb_build_object(
    'id', t.id,
    'public_code', t.public_code,
    'name', t.name,
    'organizer_name', t.organizer_name,
    'delivery_address', t.delivery_address,
    'delivery_reference', t.delivery_reference,
    'minimum_slices', t.minimum_slices,
    'total_slices', t.total_slices,
    'total_value', t.total_value,
    'status', case
      when t.status = 'open' and t.closes_at <= now() then 'expired'
      else t.status
    end,
    'closes_at', t.closes_at,
    'free_delivery', t.total_slices >= t.minimum_slices,
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'status', p.status,
        'is_viewer', private.pede_junto_hash(viewer_participant_token) = p.participant_token_hash,
        'payment_url', case
          when private.pede_junto_hash(viewer_participant_token) = p.participant_token_hash
            then p.payment_url
          else null
        end,
        'payment_expires_at', case
          when private.pede_junto_hash(viewer_participant_token) = p.participant_token_hash
            then p.payment_expires_at
          else null
        end,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', i.id,
            'flavor_id', i.flavor_id,
            'flavor_name', i.flavor_name,
            'unit_price', i.unit_price,
            'quantity', i.quantity,
            'status', i.status
          ) order by i.created_at)
          from public.pede_junto_items i
          where i.participant_id = p.id and i.status <> 'cancelled'
        ), '[]'::jsonb)
      ) order by p.created_at)
      from public.pede_junto_participants p
      where p.group_id = t.id and p.status <> 'removed'
    ), '[]'::jsonb)
  )
  from target t;
$$;

revoke all on function private.pede_junto_room_payload(uuid,text)
  from public, anon, authenticated;

create or replace function public.create_pede_junto_group(
  group_name text,
  organizer_name text,
  organizer_phone text,
  delivery_address text,
  delivery_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_phone text;
  invitation_token text := encode(extensions.gen_random_bytes(24), 'hex');
  organizer_token text := encode(extensions.gen_random_bytes(24), 'hex');
  participant_token text := encode(extensions.gen_random_bytes(24), 'hex');
  generated_code text := upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 10));
  target_group_id uuid;
begin
  normalized_phone := private.normalize_br_phone(organizer_phone);
  if char_length(trim(group_name)) not between 3 and 60 then
    raise exception 'Dê um nome curto para o grupo';
  end if;
  if char_length(trim(organizer_name)) not between 2 and 80 then
    raise exception 'Informe seu nome';
  end if;
  if char_length(trim(delivery_address)) not between 8 and 240 then
    raise exception 'Informe o endereço completo da entrega';
  end if;

  insert into public.pede_junto_groups(
    public_code, invitation_token_hash, organizer_token_hash, name,
    organizer_name, organizer_phone, delivery_address, delivery_reference
  ) values (
    generated_code, private.pede_junto_hash(invitation_token),
    private.pede_junto_hash(organizer_token), trim(group_name),
    trim(organizer_name), normalized_phone, trim(delivery_address),
    nullif(trim(delivery_reference), '')
  ) returning id into target_group_id;

  insert into public.pede_junto_participants(
    group_id, name, phone_e164, participant_token_hash
  ) values (
    target_group_id, trim(organizer_name), normalized_phone,
    private.pede_junto_hash(participant_token)
  );

  insert into public.audit_events(action, entity_type, entity_id, payload)
  values ('pede_junto.created', 'pede_junto_group', target_group_id::text,
    jsonb_build_object('public_code', generated_code));

  return jsonb_build_object(
    'public_code', generated_code,
    'invitation_token', invitation_token,
    'organizer_token', organizer_token,
    'participant_token', participant_token,
    'room', private.pede_junto_room_payload(target_group_id, participant_token)
  );
end;
$$;

revoke all on function public.create_pede_junto_group(text,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.create_pede_junto_group(text,text,text,text,text)
  to anon, authenticated;

create or replace function public.pede_junto_room(
  group_code text,
  invitation_token text,
  participant_token text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target public.pede_junto_groups%rowtype;
begin
  select * into target
  from public.pede_junto_groups g
  where g.public_code = upper(trim(group_code));
  if not found or target.invitation_token_hash <> private.pede_junto_hash(invitation_token) then
    raise exception 'Convite inválido ou expirado';
  end if;
  return private.pede_junto_room_payload(target.id, participant_token);
end;
$$;

revoke all on function public.pede_junto_room(text,text,text)
  from public, anon, authenticated;
grant execute on function public.pede_junto_room(text,text,text)
  to anon, authenticated;

create or replace function public.join_pede_junto_group(
  group_code text,
  invitation_token text,
  participant_name text,
  participant_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.pede_junto_groups%rowtype;
  normalized_phone text;
  participant_token text := encode(extensions.gen_random_bytes(24), 'hex');
  target_participant_id uuid;
begin
  select * into target from public.pede_junto_groups g
  where g.public_code = upper(trim(group_code)) for update;
  if not found or target.invitation_token_hash <> private.pede_junto_hash(invitation_token) then
    raise exception 'Convite inválido ou expirado';
  end if;
  if target.status <> 'open' or target.closes_at <= now() then
    raise exception 'Este grupo já foi encerrado';
  end if;
  if char_length(trim(participant_name)) not between 2 and 80 then
    raise exception 'Informe seu nome';
  end if;
  normalized_phone := private.normalize_br_phone(participant_phone);

  insert into public.pede_junto_participants(
    group_id, name, phone_e164, participant_token_hash
  ) values (
    target.id, trim(participant_name), normalized_phone,
    private.pede_junto_hash(participant_token)
  )
  on conflict (group_id, phone_e164) do update
    set name = excluded.name,
        participant_token_hash = excluded.participant_token_hash,
        status = 'active',
        updated_at = now()
  returning id into target_participant_id;

  return jsonb_build_object(
    'participant_id', target_participant_id,
    'participant_token', participant_token,
    'room', private.pede_junto_room_payload(target.id, participant_token)
  );
end;
$$;

revoke all on function public.join_pede_junto_group(text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.join_pede_junto_group(text,text,text,text)
  to anon, authenticated;

create or replace function public.set_pede_junto_selection(
  group_code text,
  participant_token text,
  selected_flavor_id uuid,
  selected_quantity integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_group public.pede_junto_groups%rowtype;
  target_participant public.pede_junto_participants%rowtype;
  target_flavor public.flavors%rowtype;
  current_total integer;
begin
  if selected_quantity not between 0 and 30 then
    raise exception 'Escolha uma quantidade entre 0 e 30';
  end if;
  select * into target_group from public.pede_junto_groups g
  where g.public_code = upper(trim(group_code)) for update;
  if not found or target_group.status <> 'open' or target_group.closes_at <= now() then
    raise exception 'Este grupo não aceita mais alterações';
  end if;
  select * into target_participant from public.pede_junto_participants p
  where p.group_id = target_group.id
    and p.participant_token_hash = private.pede_junto_hash(participant_token)
    and p.status = 'active';
  if not found then raise exception 'Participante não identificado'; end if;

  select * into target_flavor from public.flavors f
  where f.id = selected_flavor_id and f.active;
  if not found then raise exception 'Sabor indisponível'; end if;

  if selected_quantity = 0 then
    delete from public.pede_junto_items
    where participant_id = target_participant.id and flavor_id = target_flavor.id;
  else
    select coalesce(sum(i.quantity), 0) into current_total
    from public.pede_junto_items i
    where i.participant_id = target_participant.id and i.flavor_id <> target_flavor.id
      and i.status <> 'cancelled';
    if current_total + selected_quantity > 50 then
      raise exception 'Cada pessoa pode adicionar até 50 fatias';
    end if;
    insert into public.pede_junto_items(
      group_id, participant_id, flavor_id, flavor_name, unit_price, quantity, status
    ) values (
      target_group.id, target_participant.id, target_flavor.id,
      target_flavor.name, target_flavor.base_price, selected_quantity, 'selected'
    )
    on conflict (participant_id, flavor_id) do update
      set quantity = excluded.quantity,
          flavor_name = excluded.flavor_name,
          unit_price = excluded.unit_price,
          status = 'selected',
          updated_at = now();
  end if;

  update public.pede_junto_groups
  set free_delivery_unlocked_at = case
        when free_delivery_unlocked_at is null and (
          select coalesce(sum(i.quantity), 0)
          from public.pede_junto_items i
          join public.pede_junto_participants p on p.id = i.participant_id
          where i.group_id = target_group.id and p.status = 'active'
            and i.status = 'selected'
        ) >= minimum_slices then now()
        else free_delivery_unlocked_at
      end,
      updated_at = now()
  where id = target_group.id;

  return private.pede_junto_room_payload(target_group.id, participant_token);
end;
$$;

revoke all on function public.set_pede_junto_selection(text,text,uuid,integer)
  from public, anon, authenticated;
grant execute on function public.set_pede_junto_selection(text,text,uuid,integer)
  to anon, authenticated;

create or replace function public.submit_pede_junto_group(
  group_code text,
  organizer_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.pede_junto_groups%rowtype;
  total_slices integer;
  conflicts jsonb;
begin
  select * into target from public.pede_junto_groups g
  where g.public_code = upper(trim(group_code)) for update;
  if not found or target.organizer_token_hash <> private.pede_junto_hash(organizer_token) then
    raise exception 'Apenas o organizador pode encerrar o grupo';
  end if;
  if target.status <> 'open' then raise exception 'Este grupo já foi enviado'; end if;

  select coalesce(sum(i.quantity), 0)::integer into total_slices
  from public.pede_junto_items i
  join public.pede_junto_participants p on p.id = i.participant_id
  where i.group_id = target.id and p.status = 'active' and i.status = 'selected';
  if total_slices < target.minimum_slices then
    raise exception 'O grupo precisa de pelo menos cinco fatias';
  end if;

  perform 1 from public.flavor_availability a
  where a.service_date = (now() at time zone 'America/Fortaleza')::date and a.flavor_id in (
    select i.flavor_id from public.pede_junto_items i
    where i.group_id = target.id and i.status = 'selected'
  ) for update;

  select coalesce(jsonb_agg(jsonb_build_object(
    'flavor_id', requested.flavor_id,
    'flavor_name', requested.flavor_name,
    'requested', requested.quantity,
    'available', greatest(coalesce(a.quantity_available - a.quantity_reserved, 0), 0)
  )), '[]'::jsonb) into conflicts
  from (
    select i.flavor_id, max(i.flavor_name) as flavor_name, sum(i.quantity)::integer as quantity
    from public.pede_junto_items i
    where i.group_id = target.id and i.status = 'selected'
    group by i.flavor_id
  ) requested
  left join public.flavor_availability a
    on a.flavor_id = requested.flavor_id and a.service_date = (now() at time zone 'America/Fortaleza')::date
  where a.status is null
     or a.status in ('sold_out', 'unavailable')
     or (a.quantity_available is not null
       and a.quantity_available - a.quantity_reserved < requested.quantity);

  if jsonb_array_length(conflicts) > 0 then
    return jsonb_build_object('submitted', false, 'conflicts', conflicts);
  end if;

  update public.flavor_availability a
  set quantity_reserved = a.quantity_reserved + requested.quantity,
      updated_at = now()
  from (
    select i.flavor_id, sum(i.quantity)::integer as quantity
    from public.pede_junto_items i
    where i.group_id = target.id and i.status = 'selected'
    group by i.flavor_id
  ) requested
  where a.flavor_id = requested.flavor_id
    and a.service_date = (now() at time zone 'America/Fortaleza')::date
    and a.quantity_available is not null;

  update public.pede_junto_items set status = 'reserved', updated_at = now()
  where group_id = target.id and status = 'selected';
  update public.pede_junto_participants set status = 'payment_pending', updated_at = now()
  where group_id = target.id and status = 'active';
  update public.pede_junto_groups
  set status = 'submitted', submitted_at = now(),
      free_delivery_unlocked_at = coalesce(free_delivery_unlocked_at, now()),
      updated_at = now()
  where id = target.id;

  insert into public.audit_events(action, entity_type, entity_id, payload)
  values ('pede_junto.submitted', 'pede_junto_group', target.id::text,
    jsonb_build_object('slices', total_slices));

  return jsonb_build_object(
    'submitted', true,
    'conflicts', '[]'::jsonb,
    'room', private.pede_junto_room_payload(target.id, null)
  );
end;
$$;

revoke all on function public.submit_pede_junto_group(text,text)
  from public, anon, authenticated;
grant execute on function public.submit_pede_junto_group(text,text)
  to anon, authenticated;

create or replace function public.staff_update_pede_junto_participant(
  target_participant_id uuid,
  next_status text,
  next_payment_url text default null,
  next_payment_expires_at timestamptz default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select private.is_staff()) then
    raise exception 'Acesso restrito à equipe Adoce';
  end if;
  if next_status not in ('active', 'payment_pending', 'paid', 'removed', 'cancelled') then
    raise exception 'Situação inválida';
  end if;
  update public.pede_junto_participants
  set status = next_status,
      payment_url = nullif(trim(next_payment_url), ''),
      payment_expires_at = next_payment_expires_at,
      paid_at = case when next_status = 'paid' then coalesce(paid_at, now()) else paid_at end,
      updated_at = now()
  where id = target_participant_id;
end;
$$;

revoke all on function public.staff_update_pede_junto_participant(uuid,text,text,timestamptz)
  from public, anon, authenticated;
grant execute on function public.staff_update_pede_junto_participant(uuid,text,text,timestamptz)
  to authenticated;

create or replace function public.staff_update_pede_junto_group(
  target_group_id uuid,
  next_status text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select private.is_staff()) then
    raise exception 'Acesso restrito à equipe Adoce';
  end if;
  if next_status not in (
    'open', 'submitted', 'confirmed', 'awaiting_payment', 'preparing',
    'ready', 'completed', 'cancelled', 'expired'
  ) then raise exception 'Situação inválida'; end if;
  update public.pede_junto_groups
  set status = next_status,
      confirmed_at = case when next_status = 'confirmed' then coalesce(confirmed_at, now()) else confirmed_at end,
      updated_at = now()
  where id = target_group_id;
end;
$$;

revoke all on function public.staff_update_pede_junto_group(uuid,text)
  from public, anon, authenticated;
grant execute on function public.staff_update_pede_junto_group(uuid,text)
  to authenticated;
