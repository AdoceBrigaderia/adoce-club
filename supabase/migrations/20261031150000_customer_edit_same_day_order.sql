-- Pedido do mesmo dia, segunda etapa (pedido do proprietario em 31/10/2026):
-- o cliente que ja pediu hoje pode, no aparelho do pedido (token):
--   1. reescrever a observacao do pedido;
--   2. acrescentar ou tirar fatias enquanto a loja ainda nao confirmou
--      (status awaiting_confirmation: itens 'selected', nada separado nem
--      reservado ainda).
-- Sem token, continua so o complemento de texto (20261031120000).

-- A consulta passa a devolver a observacao e os itens com sabor e calda,
-- para a tela montar o editor.
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
    and o.public_token_hash = private.instant_order_hash(k->>'token');

  return jsonb_build_object('has_orders', total > 0, 'orders', visible);
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
    and o.public_token_hash = private.instant_order_hash(order_token)
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

-- requested_items: [{flavor_id, quantity, sauces: [{unit_number, sauce_id|null}]}]
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
    and o.public_token_hash = private.instant_order_hash(order_token)
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

revoke all on function public.public_set_order_notes(text, text, text) from public;
revoke all on function public.public_edit_order_items(text, text, jsonb) from public;
grant execute on function public.public_same_day_orders(text, jsonb) to anon, authenticated;
grant execute on function public.public_set_order_notes(text, text, text) to anon, authenticated;
grant execute on function public.public_edit_order_items(text, text, jsonb) to anon, authenticated;
