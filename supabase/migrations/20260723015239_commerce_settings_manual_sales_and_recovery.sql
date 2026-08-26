-- Configuracoes comerciais, meios de pagamento, recuperacao de pedidos expirados
-- e registro transacional de vendas feitas diretamente pela operacao.

create table if not exists public.payment_methods (
  code text primary key check (code ~ '^[a-z][a-z0-9_]{1,39}$'),
  label text not null check (char_length(label) between 2 and 60),
  fee_percent numeric(7,4) not null default 0 check (fee_percent between 0 and 100),
  fee_fixed numeric(10,2) not null default 0 check (fee_fixed >= 0),
  active boolean not null default true,
  customer_selectable boolean not null default true,
  sort_order integer not null default 0,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.payment_methods(code, label, customer_selectable, sort_order)
values
  ('pix', 'Pix', true, 10),
  ('credit_card', 'Cartão de crédito', true, 20),
  ('debit_card', 'Cartão de débito', true, 30),
  ('cash', 'Dinheiro', false, 40)
on conflict (code) do nothing;

alter table public.payment_methods enable row level security;
revoke all on public.payment_methods from public, anon, authenticated;
grant select, insert, update, delete on public.payment_methods to authenticated;
grant all on public.payment_methods to service_role;

create policy payment_methods_staff_read on public.payment_methods
  for select to authenticated using ((select private.is_staff()));
create policy payment_methods_manager_manage on public.payment_methods
  for all to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));

alter table public.instant_orders
  add column if not exists payment_method_code text references public.payment_methods(code),
  add column if not exists payment_method_label text,
  add column if not exists payment_fee_percent numeric(7,4) not null default 0,
  add column if not exists payment_fee_fixed numeric(10,2) not null default 0,
  add column if not exists gross_amount numeric(10,2),
  add column if not exists payment_fee_amount numeric(10,2) not null default 0,
  add column if not exists net_amount numeric(10,2),
  add column if not exists sales_channel text not null default 'site',
  add column if not exists payment_recorded_at timestamptz;

update public.instant_orders
set gross_amount = coalesce(gross_amount, total),
    net_amount = coalesce(net_amount, total - payment_fee_amount),
    sales_channel = coalesce(nullif(sales_channel, ''), 'site'),
    payment_recorded_at = case
      when payment_status = 'approved' then coalesce(payment_recorded_at, paid_at, completed_at, created_at)
      else payment_recorded_at
    end
where gross_amount is null or net_amount is null or sales_channel is null or sales_channel = ''
   or (payment_status = 'approved' and payment_recorded_at is null);

alter table public.instant_orders
  alter column gross_amount set not null,
  alter column net_amount set not null,
  drop constraint if exists instant_orders_sales_channel_check,
  add constraint instant_orders_sales_channel_check check (sales_channel in ('site','operation','pede_junto')),
  drop constraint if exists instant_orders_financial_amounts_check,
  add constraint instant_orders_financial_amounts_check check (
    gross_amount >= 0 and payment_fee_amount >= 0 and net_amount >= 0
  );

create index if not exists instant_orders_financial_report_idx
  on public.instant_orders(payment_recorded_at desc, payment_method_code)
  where payment_status = 'approved';

create or replace function private.snapshot_instant_order_payment(
  target_order_id uuid,
  requested_method_code text
)
returns public.instant_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  method_row public.payment_methods%rowtype;
  result public.instant_orders%rowtype;
  calculated_fee numeric(10,2);
begin
  select * into method_row from public.payment_methods
  where code = requested_method_code and active;
  if not found then raise exception 'Escolha uma forma de pagamento disponivel'; end if;

  select round((target.total * method_row.fee_percent / 100) + method_row.fee_fixed, 2)
  into calculated_fee
  from public.instant_orders target where target.id = target_order_id;

  update public.instant_orders target
  set payment_method_code = method_row.code,
      payment_method_label = method_row.label,
      payment_fee_percent = method_row.fee_percent,
      payment_fee_fixed = method_row.fee_fixed,
      gross_amount = target.total,
      payment_fee_amount = least(target.total, coalesce(calculated_fee, 0)),
      net_amount = greatest(0, target.total - coalesce(calculated_fee, 0)),
      updated_at = now()
  where target.id = target_order_id
  returning * into result;
  if not found then raise exception 'Pedido nao encontrado'; end if;
  return result;
end;
$$;
revoke all on function private.snapshot_instant_order_payment(uuid,text) from public, anon, authenticated;

create or replace function public.get_checkout_payment_methods()
returns table(code text, label text)
language sql
stable
security definer
set search_path = ''
as $$
  select method.code, method.label from public.payment_methods method
  where method.active and method.customer_selectable
  order by method.sort_order, method.label;
$$;
revoke all on function public.get_checkout_payment_methods() from public;
grant execute on function public.get_checkout_payment_methods() to anon, authenticated;

create or replace function public.submit_instant_order_v5(
  requested_customer_name text,
  requested_customer_phone text,
  requested_items jsonb,
  requested_notes text default '',
  requested_payment_method text default 'pix',
  requested_reward jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  response jsonb;
  created_order public.instant_orders%rowtype;
begin
  if requested_reward is not null and requested_reward <> 'null'::jsonb then
    response := public.submit_instant_order_v3(
      requested_customer_name, requested_customer_phone, requested_items,
      requested_notes, requested_reward
    );
  else
    response := public.submit_instant_order_v4(
      requested_customer_name, requested_customer_phone, requested_items, requested_notes
    );
  end if;
  if not coalesce((response->>'accepted')::boolean, false) then return response; end if;

  select * into created_order from public.instant_orders
  where order_number = response->>'order_number' for update;
  perform private.snapshot_instant_order_payment(created_order.id, requested_payment_method);
  return response || jsonb_build_object('payment_method', requested_payment_method);
end;
$$;
revoke all on function public.submit_instant_order_v5(text,text,jsonb,text,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.submit_instant_order_v5(text,text,jsonb,text,text,jsonb)
  to anon, authenticated;

create or replace function public.staff_get_commerce_settings()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if (select auth.uid()) is null or not private.is_staff() then raise exception 'Acesso nao autorizado'; end if;
  select jsonb_build_object(
    'automatic_checkout_enabled', settings.automatic_checkout_enabled,
    'automatic_checkout_minimum', settings.automatic_checkout_minimum,
    'reservation_minutes', settings.reservation_minutes,
    'payment_methods', coalesce((select jsonb_agg(jsonb_build_object(
      'code', method.code, 'label', method.label, 'fee_percent', method.fee_percent,
      'fee_fixed', method.fee_fixed, 'active', method.active,
      'customer_selectable', method.customer_selectable, 'sort_order', method.sort_order
    ) order by method.sort_order, method.label) from public.payment_methods method), '[]'::jsonb)
  ) into result
  from private.instant_order_settings settings where settings.singleton;
  return result;
end;
$$;
revoke all on function public.staff_get_commerce_settings() from public, anon;
grant execute on function public.staff_get_commerce_settings() to authenticated;

create or replace function public.staff_update_commerce_settings(
  next_automatic_checkout_enabled boolean,
  next_automatic_checkout_minimum integer,
  next_reservation_minutes integer,
  next_payment_methods jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare entry jsonb;
begin
  if (select auth.uid()) is null or not private.is_manager() then raise exception 'Somente proprietarios podem alterar estas configuracoes'; end if;
  if next_automatic_checkout_minimum not between 1 and 30 then raise exception 'O minimo automatico deve ficar entre 1 e 30 fatias'; end if;
  if next_reservation_minutes not between 5 and 240 then raise exception 'O prazo de reserva deve ficar entre 5 minutos e 4 horas'; end if;
  if jsonb_typeof(next_payment_methods) <> 'array' then raise exception 'Revise os meios de pagamento'; end if;

  update private.instant_order_settings
  set automatic_checkout_enabled = next_automatic_checkout_enabled,
      automatic_checkout_minimum = next_automatic_checkout_minimum,
      reservation_minutes = next_reservation_minutes,
      updated_at = now()
  where singleton;

  for entry in select * from jsonb_array_elements(next_payment_methods)
  loop
    update public.payment_methods
    set fee_percent = greatest(0, least(100, coalesce((entry->>'fee_percent')::numeric, 0))),
        fee_fixed = greatest(0, coalesce((entry->>'fee_fixed')::numeric, 0)),
        active = coalesce((entry->>'active')::boolean, active),
        customer_selectable = coalesce((entry->>'customer_selectable')::boolean, customer_selectable),
        updated_by = (select auth.uid()), updated_at = now()
    where code = entry->>'code';
  end loop;

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values ((select auth.uid()), 'commerce.settings_updated', 'commerce_settings', 'global',
    jsonb_build_object('reservation_minutes', next_reservation_minutes,
      'automatic_checkout_minimum', next_automatic_checkout_minimum));
  return public.staff_get_commerce_settings();
end;
$$;
revoke all on function public.staff_update_commerce_settings(boolean,integer,integer,jsonb) from public, anon, authenticated;
grant execute on function public.staff_update_commerce_settings(boolean,integer,integer,jsonb) to authenticated;

-- Remove a regra antiga de 60 minutos antes de permitir o novo limite global.
alter table private.instant_order_settings
  drop constraint if exists instant_order_settings_reservation_minutes_check;
alter table private.instant_order_settings
  add constraint instant_order_settings_reservation_minutes_check
  check (reservation_minutes between 5 and 240);

create or replace function public.staff_reopen_expired_instant_order(target_order_id uuid)
returns public.instant_orders
language plpgsql
security definer
set search_path = ''
as $$
declare result public.instant_orders%rowtype;
begin
  if (select auth.uid()) is null or not private.is_staff() then raise exception 'Acesso nao autorizado'; end if;
  perform 1 from public.instant_orders where id = target_order_id and status = 'expired' for update;
  if not found then raise exception 'Somente pedidos com prazo encerrado podem ser reabertos'; end if;
  update public.instant_order_items set status = 'selected', updated_at = now()
    where order_id = target_order_id and status = 'cancelled';
  update public.instant_orders set status = 'awaiting_confirmation', payment_status = 'not_started',
    reserved_until = null, payment_expires_at = null, cancellation_reason = null,
    updated_by = (select auth.uid()), updated_at = now()
  where id = target_order_id returning * into result;
  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values ((select auth.uid()), 'instant_order.reopened', 'instant_order', target_order_id::text, '{}');
  return result;
end;
$$;
revoke all on function public.staff_reopen_expired_instant_order(uuid) from public, anon;
grant execute on function public.staff_reopen_expired_instant_order(uuid) to authenticated;

create or replace function public.staff_finalize_expired_instant_order(
  target_order_id uuid,
  requested_payment_method text,
  next_internal_notes text default null,
  allow_inventory_reconciliation boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare target public.instant_orders%rowtype; requested record; shortage jsonb := '[]'::jsonb; payment_result jsonb;
begin
  if (select auth.uid()) is null or not private.is_staff() then raise exception 'Acesso nao autorizado'; end if;
  select * into target from public.instant_orders where id = target_order_id for update;
  if not found or target.status <> 'expired' then raise exception 'Este pedido nao esta com o prazo encerrado'; end if;

  update public.instant_order_items set status = 'selected', updated_at = now()
    where order_id = target_order_id and status = 'cancelled';

  if allow_inventory_reconciliation then
    for requested in
      select item.flavor_id, max(item.flavor_name) flavor_name, sum(item.quantity)::integer quantity
      from public.instant_order_items item where item.order_id = target_order_id and item.status = 'selected'
      group by item.flavor_id
    loop
      update public.flavor_availability availability
      set quantity_available = greatest(coalesce(availability.quantity_available, 0), availability.quantity_reserved + requested.quantity),
          status = case when availability.status in ('sold_out','unavailable') then 'last_units' else availability.status end,
          updated_at = now()
      where availability.flavor_id = requested.flavor_id
        and availability.service_date = (now() at time zone 'America/Fortaleza')::date;
      shortage := shortage || jsonb_build_array(jsonb_build_object('flavor', requested.flavor_name, 'quantity', requested.quantity));
    end loop;
  end if;

  update public.instant_orders set status = 'awaiting_confirmation', payment_status = 'not_started',
    cancellation_reason = null, updated_by = (select auth.uid()), updated_at = now()
  where id = target_order_id;
  perform public.staff_update_instant_order(target_order_id, 'awaiting_payment', null, null,
    coalesce(next_internal_notes, target.internal_notes), null);
  perform private.snapshot_instant_order_payment(target_order_id, requested_payment_method);
  payment_result := public.staff_confirm_instant_order_payment(target_order_id, next_internal_notes);
  perform public.staff_update_instant_order(target_order_id, 'completed', null, null,
    coalesce(next_internal_notes, target.internal_notes), null);
  update public.instant_orders set payment_recorded_at = coalesce(payment_recorded_at, now()), updated_at = now()
    where id = target_order_id;

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values ((select auth.uid()), 'instant_order.expired_sale_recovered', 'instant_order', target_order_id::text,
    jsonb_build_object('inventory_reconciliation', allow_inventory_reconciliation, 'items', shortage));
  return payment_result || jsonb_build_object('completed', true);
end;
$$;
revoke all on function public.staff_finalize_expired_instant_order(uuid,text,text,boolean) from public, anon;
grant execute on function public.staff_finalize_expired_instant_order(uuid,text,text,boolean) to authenticated;

create or replace function public.staff_create_manual_sale(
  requested_customer_name text,
  requested_customer_phone text,
  requested_items jsonb,
  requested_payment_method text,
  requested_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare normalized_phone text; raw_token text := encode(extensions.gen_random_bytes(24), 'hex'); target public.instant_orders%rowtype;
  location public.pickup_locations%rowtype; total_value numeric(10,2); total_quantity integer; payment_result jsonb;
begin
  if (select auth.uid()) is null or not private.is_staff() then raise exception 'Acesso nao autorizado'; end if;
  if jsonb_typeof(requested_items) <> 'array' or jsonb_array_length(requested_items) = 0 then raise exception 'Inclua pelo menos uma fatia'; end if;
  normalized_phone := regexp_replace(coalesce(requested_customer_phone, ''), '\D', '', 'g');
  if length(normalized_phone) in (10,11) then normalized_phone := '55' || normalized_phone; end if;
  if normalized_phone = '' then normalized_phone := '5500000000000'; end if;
  if length(normalized_phone) not in (12,13) then raise exception 'Revise o celular informado ou deixe o campo vazio'; end if;

  with requested as (
    select (entry->>'flavor_id')::uuid flavor_id, sum((entry->>'quantity')::integer)::integer quantity
    from jsonb_array_elements(requested_items) entry group by (entry->>'flavor_id')::uuid
  )
  select coalesce(sum(requested.quantity),0)::integer,
    coalesce(sum(requested.quantity * flavor.base_price),0)::numeric(10,2)
  into total_quantity, total_value from requested join public.flavors flavor on flavor.id = requested.flavor_id and flavor.active
  where requested.quantity between 1 and 30 and flavor.base_price > 0;
  if total_quantity < 1 or total_quantity > 60 then raise exception 'Revise as quantidades da venda'; end if;

  select * into location from public.pickup_locations where active order by sort_order, created_at limit 1;
  insert into public.instant_orders(order_number, public_token_hash, customer_name, customer_phone,
    status, checkout_mode, subtotal, total, gross_amount, net_amount, sales_channel,
    pickup_location_id, pickup_label, pickup_address, internal_notes, created_by, updated_by)
  values ('', private.instant_order_hash(raw_token), coalesce(nullif(btrim(requested_customer_name),''),'Venda no atendimento'),
    '+' || normalized_phone, 'awaiting_confirmation', 'staff_confirmation', total_value, total_value,
    total_value, total_value, 'operation', location.id, coalesce(location.public_label,''),
    coalesce(location.address_text,''), left(coalesce(requested_notes,''),2000), (select auth.uid()), (select auth.uid()))
  returning * into target;

  insert into public.instant_order_items(order_id, flavor_id, flavor_name, unit_price, quantity, status)
  select target.id, requested.flavor_id, flavor.name, flavor.base_price, requested.quantity, 'selected'
  from (select (entry->>'flavor_id')::uuid flavor_id, sum((entry->>'quantity')::integer)::integer quantity
    from jsonb_array_elements(requested_items) entry group by (entry->>'flavor_id')::uuid) requested
  join public.flavors flavor on flavor.id = requested.flavor_id and flavor.active;

  perform public.staff_update_instant_order(target.id, 'awaiting_payment', null, null, requested_notes, null);
  perform private.snapshot_instant_order_payment(target.id, requested_payment_method);
  payment_result := public.staff_confirm_instant_order_payment(target.id, requested_notes);
  perform public.staff_update_instant_order(target.id, 'completed', null, null, requested_notes, null);
  update public.instant_orders set payment_recorded_at = now(), updated_at = now() where id = target.id;
  return payment_result || jsonb_build_object('completed', true, 'sales_channel', 'operation');
end;
$$;
revoke all on function public.staff_create_manual_sale(text,text,jsonb,text,text) from public, anon;
grant execute on function public.staff_create_manual_sale(text,text,jsonb,text,text) to authenticated;

create or replace function public.staff_financial_sales_summary(range_start date, range_end date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if (select auth.uid()) is null or not private.is_staff() then raise exception 'Acesso nao autorizado'; end if;
  if range_start is null or range_end is null or range_end < range_start or range_end - range_start > 370 then
    raise exception 'Escolha um periodo valido de ate 370 dias';
  end if;
  with sales as (
    select target.* from public.instant_orders target
    where target.payment_status = 'approved'
      and (coalesce(target.payment_recorded_at, target.paid_at, target.created_at) at time zone 'America/Fortaleza')::date between range_start and range_end
  ), by_method as (
    select coalesce(payment_method_code,'not_informed') code,
      coalesce(max(payment_method_label),'Nao informado') label, count(*) orders,
      sum(gross_amount) gross, sum(payment_fee_amount) fees, sum(net_amount) net
    from sales group by coalesce(payment_method_code,'not_informed')
  ), by_day as (
    select (coalesce(payment_recorded_at, paid_at, created_at) at time zone 'America/Fortaleza')::date sale_date,
      count(*) orders, sum(gross_amount) gross, sum(payment_fee_amount) fees, sum(net_amount) net
    from sales group by 1
  )
  select jsonb_build_object(
    'from', range_start, 'to', range_end, 'orders', (select count(*) from sales),
    'gross', coalesce((select sum(gross_amount) from sales),0),
    'fees', coalesce((select sum(payment_fee_amount) from sales),0),
    'net', coalesce((select sum(net_amount) from sales),0),
    'by_method', coalesce((select jsonb_agg(to_jsonb(by_method) order by gross desc) from by_method),'[]'::jsonb),
    'by_day', coalesce((select jsonb_agg(to_jsonb(by_day) order by sale_date desc) from by_day),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function public.staff_financial_sales_summary(date,date) from public, anon;
grant execute on function public.staff_financial_sales_summary(date,date) to authenticated;

-- Novos pedidos passam a usar o prazo global tambem quando a operacao confirma manualmente.
create or replace function private.current_instant_order_reservation_minutes()
returns integer language sql stable security definer set search_path = '' as $$
  select reservation_minutes from private.instant_order_settings where singleton;
$$;
revoke all on function private.current_instant_order_reservation_minutes() from public, anon, authenticated;

create or replace function private.apply_instant_order_global_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare configured_minutes integer;
begin
  if new.status in ('reserved','awaiting_payment')
     and new.status is distinct from old.status then
    configured_minutes := private.current_instant_order_reservation_minutes();
    new.reserved_until := now() + make_interval(mins => configured_minutes);
    if new.status = 'awaiting_payment' then new.payment_expires_at := new.reserved_until; end if;
  end if;
  if new.payment_status = 'approved' and old.payment_status is distinct from 'approved' then
    new.payment_recorded_at := coalesce(new.payment_recorded_at, now());
    new.gross_amount := new.total;
    new.payment_fee_amount := least(new.total,
      round((new.total * coalesce(new.payment_fee_percent,0) / 100) + coalesce(new.payment_fee_fixed,0), 2));
    new.net_amount := greatest(0, new.total - new.payment_fee_amount);
  end if;
  return new;
end;
$$;
revoke all on function private.apply_instant_order_global_rules() from public, anon, authenticated;
drop trigger if exists instant_orders_global_rules on public.instant_orders;
create trigger instant_orders_global_rules
before update of status, payment_status on public.instant_orders
for each row execute function private.apply_instant_order_global_rules();
