CREATE OR REPLACE FUNCTION public.submit_instant_order(requested_customer_name text, requested_customer_phone text, requested_items jsonb, requested_notes text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  normalized_phone text;
  raw_token text := encode(extensions.gen_random_bytes(24), 'hex');
  order_row public.instant_orders%rowtype;
  location_row public.pickup_locations%rowtype;
  total_quantity integer;
  total_value numeric(10,2);
  automatic_threshold integer;
  reservation_minutes integer;
  automatic_checkout_enabled boolean;
  conflicts jsonb;
begin
  if char_length(btrim(coalesce(requested_customer_name, ''))) < 2 then
    raise exception 'Informe seu nome para identificarmos o pedido';
  end if;
  normalized_phone := regexp_replace(coalesce(requested_customer_phone, ''), '\D', '', 'g');
  if length(normalized_phone) in (10, 11) then normalized_phone := '55' || normalized_phone; end if;
  if length(normalized_phone) not in (12, 13) then
    raise exception 'Informe um WhatsApp válido com DDD';
  end if;
  if requested_items is null or jsonb_typeof(requested_items) <> 'array'
     or jsonb_array_length(requested_items) = 0 then
    raise exception 'Escolha pelo menos uma fatia';
  end if;

  select settings.automatic_checkout_enabled, settings.automatic_checkout_minimum,
    settings.reservation_minutes
  into automatic_checkout_enabled, automatic_threshold, reservation_minutes
  from private.instant_order_settings settings where settings.singleton;

  with requested as (
    select (entry->>'flavor_id')::uuid flavor_id, sum((entry->>'quantity')::integer)::integer quantity
    from jsonb_array_elements(requested_items) entry
    group by (entry->>'flavor_id')::uuid
  ), priced as (
    select requested.flavor_id, requested.quantity, flavor.name,
      coalesce(flavor.base_price, 0)::numeric(10,2) unit_price
    from requested join public.flavors flavor on flavor.id = requested.flavor_id and flavor.active
    where requested.quantity between 1 and 30 and coalesce(flavor.base_price, 0) > 0
  )
  select coalesce(sum(quantity), 0)::integer,
    coalesce(sum(quantity * unit_price), 0)::numeric(10,2)
  into total_quantity, total_value from priced;

  if total_quantity < 1 or total_quantity > 30
     or total_quantity <> (
       select coalesce(sum((entry->>'quantity')::integer), 0)::integer
       from jsonb_array_elements(requested_items) entry
     ) then
    raise exception 'Revise as fatias escolhidas e tente novamente';
  end if;

  select * into location_row from public.pickup_locations
  where active and slug = 'cantinho-da-adoce' order by sort_order, created_at limit 1;
  if location_row.id is null then raise exception 'Local de retirada Cantinho da Adoce indisponível'; end if;

  insert into public.instant_orders (
    order_number, public_token_hash, profile_id, customer_name, customer_phone,
    status, checkout_mode, subtotal, total, pickup_location_id, pickup_label,
    pickup_address, customer_notes, reserved_until, created_by
  ) values (
    '', private.instant_order_hash(raw_token), (select auth.uid()),
    btrim(requested_customer_name), '+' || normalized_phone,
    case when automatic_checkout_enabled and total_quantity >= automatic_threshold
      then 'reserved' else 'awaiting_confirmation' end,
    case when automatic_checkout_enabled and total_quantity >= automatic_threshold
      then 'automatic' else 'staff_confirmation' end,
    total_value, total_value, location_row.id, coalesce(location_row.public_label, ''),
    coalesce(location_row.address_text, ''), left(btrim(coalesce(requested_notes, '')), 1000),
    case when automatic_checkout_enabled and total_quantity >= automatic_threshold
      then now() + make_interval(mins => reservation_minutes) else null end,
    (select auth.uid())
  ) returning * into order_row;

  insert into public.instant_order_items (
    order_id, flavor_id, flavor_name, unit_price, quantity, status
  )
  select order_row.id, requested.flavor_id, flavor.name,
    flavor.base_price::numeric(10,2), requested.quantity, 'selected'
  from (
    select (entry->>'flavor_id')::uuid flavor_id, sum((entry->>'quantity')::integer)::integer quantity
    from jsonb_array_elements(requested_items) entry
    group by (entry->>'flavor_id')::uuid
  ) requested
  join public.flavors flavor on flavor.id = requested.flavor_id and flavor.active;

  if automatic_checkout_enabled and total_quantity >= automatic_threshold then
    conflicts := private.reserve_instant_order_stock(order_row.id);
    if jsonb_array_length(conflicts) > 0 then
      update public.instant_orders
      set status = 'cancelled', cancellation_reason = 'Estoque alterado durante o pedido',
          reserved_until = null, updated_at = now()
      where id = order_row.id;
      return jsonb_build_object(
        'accepted', false,
        'conflicts', conflicts,
        'message', 'Alguma fatia acabou de ser escolhida por outra pessoa. Veja as opções disponíveis e monte o pedido novamente.'
      );
    end if;
  end if;

  insert into public.outbox_events(topic, aggregate_type, aggregate_id, payload)
  values ('instant_order.created', 'instant_order', order_row.id,
    jsonb_build_object('order_number', order_row.order_number, 'quantity', total_quantity,
      'checkout_mode', order_row.checkout_mode, 'total', total_value));

  return jsonb_build_object(
    'accepted', true,
    'order_number', order_row.order_number,
    'token', raw_token,
    'status', order_row.status,
    'checkout_mode', order_row.checkout_mode,
    'total', order_row.total,
    'reserved_until', order_row.reserved_until,
    'pickup_label', order_row.pickup_label,
    'pickup_address', order_row.pickup_address,
    'message', case
      when automatic_checkout_enabled and total_quantity >= automatic_threshold then
        'As fatias foram separadas enquanto preparamos o pagamento.'
      else
        'Recebemos seu pedido. A Adoce vai conferir a disponibilidade e responder pelo WhatsApp.'
    end
  );
end;
$function$

