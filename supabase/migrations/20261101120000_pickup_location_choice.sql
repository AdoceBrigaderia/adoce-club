begin;

-- Pedido do proprietário em 01/11/2026: o cliente passa a poder escolher
-- entre as duas retiradas já cadastradas em public.pickup_locations
-- ("Cantinho da Adoce" e "Adoce Brigaderia") em vez de sempre sair fixo em
-- "cantinho-da-adoce". O endereço e o nome continuam vindo só dessa
-- tabela (fonte única) -- o cliente manda o slug escolhido, nunca o texto
-- do endereço, pra não dar pra forjar um endereço fora da lista.
create or replace function public.submit_instant_order_v7(
  requested_operation_key uuid,
  requested_customer_name text,
  requested_customer_phone text,
  requested_items jsonb,
  requested_notes text DEFAULT ''::text,
  requested_payment_method text DEFAULT 'pix'::text,
  requested_reward jsonb DEFAULT NULL::jsonb,
  requested_pickup_time time without time zone DEFAULT NULL::time without time zone,
  requested_pickup_method text DEFAULT 'customer'::text,
  requested_pickup_location_slug text DEFAULT 'cantinho-da-adoce'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  normalized_request jsonb;
  calculated_request_hash text;
  previous_request private.public_instant_order_requests%rowtype;
  response jsonb;
  created_order public.instant_orders%rowtype;
  requested_item jsonb;
  requested_quantity integer;
  phone_rate_limit jsonb;
  account_rate_limit jsonb;
  caller_id uuid := auth.uid();
  local_date date := (now() at time zone 'America/Fortaleza')::date;
  local_time time := (now() at time zone 'America/Fortaleza')::time;
  batch_deadline time := time '23:59:59';
  location_row public.pickup_locations%rowtype;
begin
  if requested_operation_key is null then raise exception 'Chave da operação inválida'; end if;

  normalized_request := jsonb_build_object(
    'customer_name', btrim(coalesce(requested_customer_name, '')),
    'customer_phone', regexp_replace(coalesce(requested_customer_phone, ''), '\D', '', 'g'),
    'items', coalesce(requested_items, 'null'::jsonb),
    'notes', btrim(coalesce(requested_notes, '')),
    'payment_method', btrim(coalesce(requested_payment_method, '')),
    'reward', coalesce(requested_reward, 'null'::jsonb),
    'pickup_time', requested_pickup_time,
    'pickup_method', requested_pickup_method,
    'pickup_location_slug', coalesce(requested_pickup_location_slug, '')
  );
  calculated_request_hash := encode(
    extensions.digest(normalized_request::text, 'sha256'), 'hex'
  );
  perform pg_advisory_xact_lock(hashtextextended(
    'public-instant-order:' || requested_operation_key::text, 0
  ));
  delete from private.public_instant_order_requests stored
  where stored.operation_key = requested_operation_key and stored.expires_at <= now();
  select * into previous_request from private.public_instant_order_requests stored
  where stored.operation_key = requested_operation_key;
  if found then
    if previous_request.request_hash <> calculated_request_hash then
      raise exception 'A chave da operação já foi usada com outro pedido';
    end if;
    return previous_request.response_payload || jsonb_build_object('idempotent', true);
  end if;

  -- Compatibilidade: navegadores antigos podem enviar horario oculto.
  -- O horario nao condiciona reserva; disponibilidade e informativa.
  requested_pickup_time := null;
  if requested_pickup_method is not null
     and requested_pickup_method not in ('customer', 'driver') then
    raise exception 'Método de retirada inválido';
  end if;

  select * into location_row from public.pickup_locations
  where active and slug = coalesce(nullif(requested_pickup_location_slug, ''), 'cantinho-da-adoce')
  order by sort_order, created_at limit 1;
  if location_row.id is null then raise exception 'Escolha um local de retirada válido'; end if;

  -- A checagem contra business_hours ficava aqui. Ver 20260819170000.

  if requested_items is null or jsonb_typeof(requested_items) <> 'array' then
    raise exception 'Escolha pelo menos uma fatia';
  end if;
  for requested_item in select value from jsonb_array_elements(requested_items)
  loop
    requested_quantity := (requested_item->>'quantity')::integer;
    if private.flavor_batch_quantity_by_time(
      (requested_item->>'flavor_id')::uuid,
      local_date,
      batch_deadline
    ) < requested_quantity then
      raise exception 'A quantidade escolhida não está disponível para hoje';
    end if;
  end loop;
  if requested_reward is not null and requested_reward <> 'null'::jsonb
     and private.flavor_batch_quantity_by_time(
       (requested_reward->>'flavor_id')::uuid,
       local_date,
       batch_deadline
     ) < 1 then
    raise exception 'A fatia-presente escolhida não está disponível para hoje';
  end if;

  phone_rate_limit := public.consume_public_endpoint_rate_limit_bff(
    'instant-order:db-phone',
    encode(extensions.digest(
      'phone:' || (normalized_request->>'customer_phone'), 'sha256'
    ), 'hex'),
    3600, 8
  );
  if not coalesce((phone_rate_limit->>'allowed')::boolean, false) then
    raise exception 'Muitas tentativas. Aguarde antes de enviar outro pedido.';
  end if;
  if caller_id is not null then
    account_rate_limit := public.consume_public_endpoint_rate_limit_bff(
      'instant-order:db-account',
      encode(extensions.digest('account:' || caller_id::text, 'sha256'), 'hex'),
      3600, 12
    );
    if not coalesce((account_rate_limit->>'allowed')::boolean, false) then
      raise exception 'Muitas tentativas. Aguarde antes de enviar outro pedido.';
    end if;
  end if;

  response := public.submit_instant_order_v5(
    requested_customer_name,
    requested_customer_phone,
    requested_items,
    requested_notes,
    requested_payment_method,
    requested_reward
  );
  if coalesce((response->>'accepted')::boolean, false) then
    select * into created_order from public.instant_orders
    where order_number = response->>'order_number' for update;
    update public.instant_orders
    set pickup_requested_time = requested_pickup_time,
        pickup_method = requested_pickup_method,
        pickup_location_id = location_row.id,
        pickup_label = coalesce(location_row.public_label, ''),
        pickup_address = coalesce(location_row.address_text, ''),
        updated_at = now()
    where id = created_order.id;
    for requested_item in
      select to_jsonb(item) from public.instant_order_items item
      where item.order_id = created_order.id and item.status = 'reserved'
    loop
      perform private.allocate_instant_order_item_batches((requested_item->>'id')::uuid);
    end loop;
    response := response || jsonb_build_object(
      'pickup_requested_time', to_char(requested_pickup_time, 'HH24:MI'),
      'pickup_method', requested_pickup_method,
      'pickup_location_slug', location_row.slug,
      'pickup_location_name', location_row.name,
      'pickup_label', coalesce(location_row.public_label, ''),
      'pickup_address', coalesce(location_row.address_text, '')
    );
  end if;

  insert into private.public_instant_order_requests(
    operation_key, request_hash, response_payload
  ) values (requested_operation_key, calculated_request_hash, response);
  return response || jsonb_build_object('idempotent', false);
end;
$function$;

commit;
