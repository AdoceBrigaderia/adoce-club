-- Codigo pelo WhatsApp para editar o pedido do dia em outro aparelho
-- (decisao do proprietario em 31/10/2026). Quem pediu pelo computador e quer
-- mexer pelo celular pede um codigo; o codigo chega no WhatsApp do pedido e,
-- confirmado, libera neste aparelho um acesso proprio a cada pedido do dia
-- (o token original do aparelho do pedido continua valendo).

create table if not exists private.order_access_codes (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null,
  code_hash text not null,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists order_access_codes_phone_idx on private.order_access_codes (phone_e164, created_at desc);

create table if not exists private.order_access_grants (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.instant_orders(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists order_access_grants_order_idx on private.order_access_grants (order_id);

create or replace function private.instant_order_token_ok(target_order uuid, stored_hash text, raw_token text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(raw_token, '') <> '' and (
    stored_hash = private.instant_order_hash(raw_token)
    or exists (
      select 1 from private.order_access_grants g
      where g.order_id = target_order
        and g.token_hash = private.instant_order_hash(raw_token)
        and g.expires_at > now()
    )
  );
$$;

-- Chamadas apenas pela funcao do servidor (service_role), que envia o codigo.
create or replace function public.server_create_order_access_code(requested_phone text, requested_code text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  target_phone text := private.same_day_phone_e164(requested_phone);
  today date := (now() at time zone 'America/Fortaleza')::date;
begin
  if target_phone is null or requested_code !~ '^[0-9]{6}$' then
    return jsonb_build_object('ok', false);
  end if;
  if not exists (
    select 1 from public.instant_orders o
    where o.customer_phone = target_phone
      and o.status not in ('cancelled', 'expired')
      and (o.created_at at time zone 'America/Fortaleza')::date = today
  ) then
    return jsonb_build_object('ok', false);
  end if;
  update private.order_access_codes set consumed_at = now()
  where phone_e164 = target_phone and consumed_at is null;
  insert into private.order_access_codes (phone_e164, code_hash, expires_at)
  values (target_phone, private.instant_order_hash(target_phone || ':' || requested_code), now() + interval '10 minutes');
  insert into public.audit_events (action, entity_type, entity_id, payload)
  values ('customer_order_access_code_sent', 'instant_order_phone', right(target_phone, 4), '{}'::jsonb);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.server_verify_order_access_code(requested_phone text, requested_code text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  target_phone text := private.same_day_phone_e164(requested_phone);
  today date := (now() at time zone 'America/Fortaleza')::date;
  pending private.order_access_codes%rowtype;
  order_row record;
  raw_token text;
  granted jsonb := '[]'::jsonb;
begin
  if target_phone is null then
    return jsonb_build_object('ok', false, 'message', 'Código inválido.');
  end if;
  select * into pending from private.order_access_codes
  where phone_e164 = target_phone and consumed_at is null and expires_at > now()
  order by created_at desc limit 1 for update;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'O código expirou. Peça um novo.');
  end if;
  if pending.attempts >= 5 then
    return jsonb_build_object('ok', false, 'message', 'Muitas tentativas. Peça um novo código.');
  end if;
  if pending.code_hash <> private.instant_order_hash(target_phone || ':' || coalesce(requested_code, '')) then
    update private.order_access_codes set attempts = attempts + 1 where id = pending.id;
    return jsonb_build_object('ok', false, 'message', 'Código incorreto. Confira a mensagem no WhatsApp.');
  end if;
  update private.order_access_codes set consumed_at = now() where id = pending.id;

  for order_row in
    select o.id, o.order_number from public.instant_orders o
    where o.customer_phone = target_phone
      and o.status not in ('cancelled', 'expired')
      and (o.created_at at time zone 'America/Fortaleza')::date = today
  loop
    raw_token := encode(extensions.gen_random_bytes(24), 'hex');
    insert into private.order_access_grants (order_id, token_hash, expires_at)
    values (order_row.id, private.instant_order_hash(raw_token),
            ((today + 1)::timestamp at time zone 'America/Fortaleza'));
    granted := granted || jsonb_build_array(jsonb_build_object('order_number', order_row.order_number, 'token', raw_token));
    insert into public.audit_events (action, entity_type, entity_id, payload)
    values ('customer_order_access_granted', 'instant_order', order_row.id::text, '{}'::jsonb);
  end loop;

  return jsonb_build_object('ok', true, 'orders', granted);
end;
$$;

revoke all on function private.instant_order_token_ok(uuid, text, text) from public;
revoke all on function public.server_create_order_access_code(text, text) from public, anon, authenticated;
revoke all on function public.server_verify_order_access_code(text, text) from public, anon, authenticated;
grant execute on function public.server_create_order_access_code(text, text) to service_role;
grant execute on function public.server_verify_order_access_code(text, text) to service_role;

-- "Acompanhar pedido" tambem aceita o acesso liberado pelo codigo.
create or replace function public.get_instant_order(order_code text, order_token text)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'order_number', target.order_number,
    'status', target.status,
    'payment_status', target.payment_status,
    'total', target.total,
    'payment_url', target.payment_url,
    'payment_expires_at', target.payment_expires_at,
    'reserved_until', target.reserved_until,
    'pickup_label', target.pickup_label,
    'pickup_address', target.pickup_address,
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'name', item.flavor_name, 'quantity', item.quantity,
      'unit_price', item.unit_price, 'status', item.status
    ) order by item.created_at) from public.instant_order_items item
      where item.order_id = target.id), '[]'::jsonb)
  )
  from public.instant_orders target
  where target.order_number = upper(btrim(order_code))
    and private.instant_order_token_ok(target.id, target.public_token_hash, order_token);
$$;

-- As funcoes do pedido do mesmo dia passam a aceitar os dois tipos de acesso.

create or replace function public.public_same_day_orders(requested_phone text, known_orders jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  target_phone text := private.same_day_phone_e164(requested_phone);
  today date := (now() at time zone 'America/Fortaleza')::date;
  total integer;
  visible jsonb;
begin
  if target_phone is null then
    return jsonb_build_object('has_orders', false, 'orders', '[]'::jsonb);
  end if;

  select count(*) into total
  from public.instant_orders o
  where o.customer_phone = target_phone
    and o.status not in ('cancelled', 'expired')
    and (o.created_at at time zone 'America/Fortaleza')::date = today;

  select coalesce(jsonb_agg(jsonb_build_object(
      'order_number', o.order_number,
      'status', o.status,
      'created_at', o.created_at,
      'total', o.total,
      'customer_notes', o.customer_notes,
      'can_cancel', o.status = 'awaiting_confirmation',
      'can_edit_items', o.status = 'awaiting_confirmation'
        and not exists (select 1 from public.instant_order_items r where r.order_id = o.id and r.is_reward),
      'items', coalesce((select jsonb_agg(jsonb_build_object(
          'flavor_id', i.flavor_id,
          'name', i.flavor_name,
          'quantity', i.quantity,
          'sauces', coalesce((select jsonb_agg(jsonb_build_object('unit_number', c.unit_number, 'sauce_id', c.sauce_id) order by c.unit_number)
                              from public.instant_order_item_sauces c where c.order_item_id = i.id), '[]'::jsonb)
        ) order by i.created_at)
        from public.instant_order_items i
        where i.order_id = o.id and not i.is_reward and i.status not in ('cancelled', 'unavailable')), '[]'::jsonb)
    ) order by o.created_at desc), '[]'::jsonb)
  into visible
  from public.instant_orders o
  join lateral jsonb_array_elements(case when jsonb_typeof(known_orders) = 'array' then known_orders else '[]'::jsonb end) k on true
  where o.customer_phone = target_phone
    and o.status not in ('cancelled', 'expired')
    and (o.created_at at time zone 'America/Fortaleza')::date = today
    and o.order_number = upper(btrim(k->>'order_number'))
    and private.instant_order_token_ok(o.id, o.public_token_hash, k->>'token');

  return jsonb_build_object('has_orders', total > 0, 'orders', visible);
end;
$$;

create or replace function public.public_add_order_complement(
  requested_phone text,
  requested_note text,
  order_code text default null,
  order_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  target_phone text := private.same_day_phone_e164(requested_phone);
  today date := (now() at time zone 'America/Fortaleza')::date;
  note text := left(btrim(coalesce(requested_note, '')), 500);
  target public.instant_orders%rowtype;
  previous integer;
begin
  if target_phone is null or length(note) < 2 then
    return jsonb_build_object('ok', false, 'message', 'Escreva o que você quer acrescentar ao pedido.');
  end if;

  select o.* into target
  from public.instant_orders o
  where o.customer_phone = target_phone
    and o.status not in ('cancelled', 'expired', 'completed')
    and (o.created_at at time zone 'America/Fortaleza')::date = today
    and (order_code is null or (o.order_number = upper(btrim(order_code))
         and private.instant_order_token_ok(o.id, o.public_token_hash, order_token)))
  order by o.created_at desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Não encontramos um pedido em andamento hoje para este celular. Fale com a loja pelo WhatsApp.');
  end if;

  select count(*) into previous from public.audit_events
  where entity_type = 'instant_order' and entity_id = target.id::text and action = 'customer_order_complement';
  if previous >= 5 then
    return jsonb_build_object('ok', false, 'message', 'Este pedido já recebeu vários complementos. Fale com a loja pelo WhatsApp.');
  end if;

  update public.instant_orders
  set customer_notes = concat_ws(E'\n', nullif(customer_notes, ''),
        '[Complemento ' || to_char(now() at time zone 'America/Fortaleza', 'HH24:MI') || '] ' || note),
      updated_at = now()
  where id = target.id;

  insert into public.audit_events (action, entity_type, entity_id, payload)
  values ('customer_order_complement', 'instant_order', target.id::text,
          jsonb_build_object('note', note, 'with_token', order_code is not null));

  return jsonb_build_object('ok', true, 'message', 'Pronto! Sua observação foi enviada junto com o pedido de hoje.');
end;
$$;

create or replace function public.public_cancel_instant_order(order_code text, order_token text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  target public.instant_orders%rowtype;
begin
  select o.* into target
  from public.instant_orders o
  where o.order_number = upper(btrim(order_code))
    and private.instant_order_token_ok(o.id, o.public_token_hash, order_token)
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Pedido não encontrado.');
  end if;
  if target.status <> 'awaiting_confirmation' then
    return jsonb_build_object('ok', false, 'message', 'A loja já começou a cuidar deste pedido. Para cancelar, fale com a gente pelo WhatsApp.');
  end if;

  update public.instant_orders
  set status = 'cancelled', cancellation_reason = 'Cancelado pelo cliente no site', updated_at = now()
  where id = target.id;

  insert into public.audit_events (action, entity_type, entity_id, payload)
  values ('customer_order_cancel', 'instant_order', target.id::text,
          jsonb_build_object('order_number', target.order_number, 'previous_status', target.status));

  return jsonb_build_object('ok', true, 'message', 'Pedido cancelado.');
end;
$$;

create or replace function public.public_set_order_notes(order_code text, order_token text, requested_notes text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  target public.instant_orders%rowtype;
  next_notes text := nullif(left(btrim(coalesce(requested_notes, '')), 500), '');
begin
  select o.* into target from public.instant_orders o
  where o.order_number = upper(btrim(order_code))
    and private.instant_order_token_ok(o.id, o.public_token_hash, order_token)
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Pedido não encontrado.');
  end if;
  if target.status in ('completed', 'cancelled', 'expired') then
    return jsonb_build_object('ok', false, 'message', 'Este pedido já foi encerrado. Fale com a loja pelo WhatsApp.');
  end if;

  update public.instant_orders set customer_notes = next_notes, updated_at = now() where id = target.id;

  insert into public.audit_events (action, entity_type, entity_id, payload)
  values ('customer_order_notes_edit', 'instant_order', target.id::text,
          jsonb_build_object('previous_notes', target.customer_notes, 'notes', next_notes));

  return jsonb_build_object('ok', true, 'message', 'Observação do pedido atualizada.');
end;
$$;

create or replace function public.public_edit_order_items(order_code text, order_token text, requested_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  target public.instant_orders%rowtype;
  entry jsonb;
  sauce_entry jsonb;
  flavor_row public.flavors%rowtype;
  availability_row public.flavor_availability%rowtype;
  wanted integer;
  total_quantity integer := 0;
  new_item uuid;
  unit integer;
  chosen_sauce uuid;
  previous_items jsonb;
  new_total numeric(10,2);
  today date := (now() at time zone 'America/Fortaleza')::date;
begin
  select o.* into target from public.instant_orders o
  where o.order_number = upper(btrim(order_code))
    and private.instant_order_token_ok(o.id, o.public_token_hash, order_token)
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Pedido não encontrado.');
  end if;
  if target.status <> 'awaiting_confirmation' then
    return jsonb_build_object('ok', false, 'message', 'A loja já confirmou e começou a separar este pedido. Para mudar as fatias, fale com a gente pelo WhatsApp.');
  end if;
  if exists (select 1 from public.instant_order_items where order_id = target.id and is_reward) then
    return jsonb_build_object('ok', false, 'message', 'Este pedido tem uma fatia-presente. Para mudar as fatias, fale com a loja pelo WhatsApp.');
  end if;
  if requested_items is null or jsonb_typeof(requested_items) <> 'array' or jsonb_array_length(requested_items) = 0 then
    return jsonb_build_object('ok', false, 'message', 'O pedido precisa ter pelo menos uma fatia. Para desistir de tudo, use "Cancelar este pedido".');
  end if;
  if (select count(*) from jsonb_array_elements(requested_items))
     <> (select count(distinct value->>'flavor_id') from jsonb_array_elements(requested_items)) then
    return jsonb_build_object('ok', false, 'message', 'Cada sabor deve aparecer uma vez só.');
  end if;

  for entry in select value from jsonb_array_elements(requested_items) loop
    wanted := coalesce((entry->>'quantity')::integer, 0);
    if wanted < 1 or wanted > 30 then
      return jsonb_build_object('ok', false, 'message', 'Quantidade de fatias inválida.');
    end if;
    total_quantity := total_quantity + wanted;
    if total_quantity > 30 then
      return jsonb_build_object('ok', false, 'message', 'O pedido aceita no máximo 30 fatias.');
    end if;

    select * into flavor_row from public.flavors
    where id = (entry->>'flavor_id')::uuid and active and coalesce(base_price, 0) > 0;
    if not found then
      return jsonb_build_object('ok', false, 'message', 'Um dos sabores não está mais disponível.');
    end if;

    -- Fatias que ja estao neste pedido nao contam contra o estoque livre.
    select * into availability_row from public.flavor_availability
    where flavor_id = flavor_row.id and service_date = today;
    if found and (
         availability_row.status not in ('available', 'last_units', 'preorder_only')
         or (availability_row.quantity_available is not null
             and availability_row.quantity_available - availability_row.quantity_reserved
                 + coalesce((select sum(i.quantity) from public.instant_order_items i
                             where i.order_id = target.id and i.flavor_id = flavor_row.id and i.status = 'reserved'), 0)
                 < wanted)) then
      return jsonb_build_object('ok', false, 'message', format('Não temos %s fatia(s) de %s disponíveis agora.', wanted, flavor_row.name));
    end if;

    if jsonb_typeof(entry->'sauces') = 'array' then
      for sauce_entry in select value from jsonb_array_elements(entry->'sauces') loop
        chosen_sauce := nullif(sauce_entry->>'sauce_id', '')::uuid;
        if chosen_sauce is not null and not exists (select 1 from public.order_sauces where id = chosen_sauce and active) then
          return jsonb_build_object('ok', false, 'message', 'Uma das caldas escolhidas acabou. Escolha outra.');
        end if;
      end loop;
    end if;
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object('flavor_id', i.flavor_id, 'name', i.flavor_name, 'quantity', i.quantity) order by i.created_at), '[]'::jsonb)
  into previous_items
  from public.instant_order_items i where i.order_id = target.id and not i.is_reward;

  delete from public.instant_order_items where order_id = target.id and not is_reward;

  for entry in select value from jsonb_array_elements(requested_items) loop
    wanted := (entry->>'quantity')::integer;
    select * into flavor_row from public.flavors where id = (entry->>'flavor_id')::uuid;
    insert into public.instant_order_items (order_id, flavor_id, flavor_name, unit_price, quantity, status, is_reward)
    values (target.id, flavor_row.id, flavor_row.name, flavor_row.base_price::numeric(10,2), wanted, 'selected', false)
    returning id into new_item;

    for unit in 1..wanted loop
      chosen_sauce := null;
      if jsonb_typeof(entry->'sauces') = 'array' then
        select nullif(value->>'sauce_id', '')::uuid into chosen_sauce
        from jsonb_array_elements(entry->'sauces') where (value->>'unit_number')::integer = unit limit 1;
      end if;
      insert into public.instant_order_item_sauces (order_item_id, unit_number, sauce_id, sauce_name)
      values (new_item, unit, chosen_sauce,
              coalesce((select name from public.order_sauces where id = chosen_sauce), 'Sem calda'));
    end loop;
  end loop;

  select coalesce(sum(quantity * unit_price), 0)::numeric(10,2) into new_total
  from public.instant_order_items where order_id = target.id and status not in ('cancelled', 'unavailable');

  update public.instant_orders
  set subtotal = new_total, total = new_total, gross_amount = new_total,
      net_amount = greatest(0, new_total - coalesce(payment_fee_amount, 0)), updated_at = now()
  where id = target.id;

  insert into public.audit_events (action, entity_type, entity_id, payload)
  values ('customer_order_items_edit', 'instant_order', target.id::text,
          jsonb_build_object('order_number', target.order_number, 'previous_items', previous_items, 'requested_items', requested_items));

  return jsonb_build_object('ok', true, 'message', 'Pronto! As fatias do seu pedido foram atualizadas.', 'total', new_total);
end;
$$;
