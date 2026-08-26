-- Instant Order: remove o bloqueio por janela de atendimento do Cantinho.
--
-- POR QUE.
-- A versao anterior de submit_instant_order_v7 exigia que o horario de retirada
-- caisse dentro de business_hours do canal 'in_person' no dia corrente. Mas
-- business_hours so tem 'in_person' nos weekdays 4, 5 e 6 (quinta, sexta e
-- sabado). De domingo a quarta nao existe janela nenhuma, entao pickup_allowed
-- ficava falso e a funcao recusava TODO pedido com
-- 'Escolha um horário dentro do atendimento do Cantinho da Adoce'.
--
-- Efeito real: o ultimo pedido entrou no sabado 15/08/2026 as 19h55. De domingo
-- 16/08 ate quarta 19/08 nenhum pedido conseguiu ser criado. Quatro dias sem
-- venda, sem erro visivel para a operacao.
--
-- O QUE CONTINUA VALENDO.
--   * requested_pickup_time obrigatorio
--   * requested_pickup_time nao pode estar no passado
--   * requested_pickup_method restrito a 'customer' ou 'driver'
--   * quantidade por fornada (private.flavor_batch_quantity_by_time), tanto
--     para os itens quanto para a fatia-presente
--   * idempotencia por operation_key e os dois limites de tentativa
--
-- O QUE SAI: apenas a checagem contra business_hours / business_hour_exceptions.
-- Nada de schema, RLS, caldas, clube, pagamento ou WhatsApp foi tocado.

create or replace function public.submit_instant_order_v7(
  requested_operation_key uuid,
  requested_customer_name text,
  requested_customer_phone text,
  requested_items jsonb,
  requested_notes text default ''::text,
  requested_payment_method text default 'pix'::text,
  requested_reward jsonb default null::jsonb,
  requested_pickup_time time without time zone default null::time without time zone,
  requested_pickup_method text default 'customer'::text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
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
    'pickup_method', requested_pickup_method
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

  if requested_pickup_time is null then raise exception 'Escolha o horário da retirada'; end if;
  if requested_pickup_method not in ('customer', 'driver') then
    raise exception 'Escolha quem fará a retirada';
  end if;
  if requested_pickup_time < local_time then
    raise exception 'Escolha um horário de retirada que ainda não passou';
  end if;

  -- A checagem contra business_hours ficava aqui. Ver o comentario do topo.

  if requested_items is null or jsonb_typeof(requested_items) <> 'array' then
    raise exception 'Escolha pelo menos uma fatia';
  end if;
  for requested_item in select value from jsonb_array_elements(requested_items)
  loop
    requested_quantity := (requested_item->>'quantity')::integer;
    if private.flavor_batch_quantity_by_time(
      (requested_item->>'flavor_id')::uuid,
      local_date,
      requested_pickup_time
    ) < requested_quantity then
      raise exception 'A quantidade escolhida não fica pronta até o horário informado';
    end if;
  end loop;
  if requested_reward is not null and requested_reward <> 'null'::jsonb
     and private.flavor_batch_quantity_by_time(
       (requested_reward->>'flavor_id')::uuid,
       local_date,
       requested_pickup_time
     ) < 1 then
    raise exception 'A fatia-presente escolhida não fica pronta até o horário informado';
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
      'pickup_method', requested_pickup_method
    );
  end if;

  insert into private.public_instant_order_requests(
    operation_key, request_hash, response_payload
  ) values (requested_operation_key, calculated_request_hash, response);
  return response || jsonb_build_object('idempotent', false);
end;
$function$;
