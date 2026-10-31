-- Pedido repetido no mesmo dia (decisao do proprietario em 31/10/2026).
-- Clientes refaziam o pedido online so para mandar uma observacao esquecida.
-- Antes de criar outro pedido, o carrinho pergunta o que a pessoa quer fazer
-- com o pedido de hoje daquele celular.
--
-- Privacidade: so o celular nao revela nada alem de "existe pedido hoje".
-- Detalhes (numero, situacao, itens) e o cancelamento exigem o token do
-- pedido, que fica apenas no aparelho onde ele foi feito. O complemento sem
-- token so acrescenta texto ao pedido mais recente do dia, sem mostrar nada.

create or replace function private.same_day_phone_e164(requested_phone text)
returns text
language sql
immutable
set search_path to ''
as $$
  select case
    when length(d) in (10, 11) then '+55' || d
    when length(d) in (12, 13) and left(d, 2) = '55' then '+' || d
    else null
  end
  from (select regexp_replace(coalesce(requested_phone, ''), '\D', '', 'g') d) s;
$$;

-- known_orders: [{"order_number": "...", "token": "..."}] guardados no aparelho.
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
      'can_cancel', o.status = 'awaiting_confirmation',
      'items', coalesce((select jsonb_agg(jsonb_build_object('name', i.flavor_name, 'quantity', i.quantity) order by i.created_at)
                         from public.instant_order_items i where i.order_id = o.id), '[]'::jsonb)
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
         and o.public_token_hash = private.instant_order_hash(order_token)))
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
    and o.public_token_hash = private.instant_order_hash(order_token)
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

revoke all on function private.same_day_phone_e164(text) from public;
revoke all on function public.public_same_day_orders(text, jsonb) from public;
revoke all on function public.public_add_order_complement(text, text, text, text) from public;
revoke all on function public.public_cancel_instant_order(text, text) from public;
grant execute on function public.public_same_day_orders(text, jsonb) to anon, authenticated;
grant execute on function public.public_add_order_complement(text, text, text, text) to anon, authenticated;
grant execute on function public.public_cancel_instant_order(text, text) to anon, authenticated;
