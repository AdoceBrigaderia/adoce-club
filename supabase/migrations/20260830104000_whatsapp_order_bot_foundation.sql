begin;

create table if not exists private.whatsapp_order_conversations (
  phone_hmac text primary key check (phone_hmac ~ '^[a-f0-9]{64}$'),
  phone_last4 text not null check (phone_last4 ~ '^[0-9]{4}$'),
  step text not null check (step in (
    'choose_items', 'name', 'sauce', 'payment', 'pickup_method',
    'pickup_time', 'confirm', 'handoff', 'completed'
  )),
  state jsonb not null default '{}'::jsonb check (jsonb_typeof(state) = 'object'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists private.whatsapp_order_messages (
  message_sid text primary key check (char_length(message_sid) between 8 and 80),
  phone_hmac text not null check (phone_hmac ~ '^[a-f0-9]{64}$'),
  status text not null default 'processing' check (status in ('processing', 'completed')),
  response_xml text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_order_conversations_expiry_idx
  on private.whatsapp_order_conversations(expires_at);
create index if not exists whatsapp_order_messages_created_idx
  on private.whatsapp_order_messages(created_at);

revoke all on table private.whatsapp_order_conversations from public, anon, authenticated;
revoke all on table private.whatsapp_order_messages from public, anon, authenticated;
grant select, insert, update, delete on table private.whatsapp_order_conversations to service_role;
grant select, insert, update, delete on table private.whatsapp_order_messages to service_role;

comment on table private.whatsapp_order_conversations is
  'Estado temporario do pedido pelo WhatsApp, indexado somente por HMAC do telefone.';
comment on table private.whatsapp_order_messages is
  'Deduplicacao de webhooks Twilio por MessageSid; nao armazena telefone nem mensagem recebida.';

create or replace function public.server_begin_whatsapp_order_message(
  requested_message_sid text,
  requested_phone_hmac text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing private.whatsapp_order_messages%rowtype;
begin
  if char_length(coalesce(requested_message_sid, '')) not between 8 and 80
     or coalesce(requested_phone_hmac, '') !~ '^[a-f0-9]{64}$' then
    raise exception 'Evento de mensagem invalido' using errcode = '22023';
  end if;

  delete from private.whatsapp_order_messages where created_at < now() - interval '7 days';

  insert into private.whatsapp_order_messages(message_sid, phone_hmac)
  values (requested_message_sid, requested_phone_hmac)
  on conflict (message_sid) do nothing;

  select * into existing
  from private.whatsapp_order_messages
  where message_sid = requested_message_sid
  for update;

  if existing.phone_hmac <> requested_phone_hmac then
    raise exception 'Evento de mensagem conflitante' using errcode = '22023';
  end if;

  if existing.status = 'completed' then
    return jsonb_build_object('process', false, 'response_xml', coalesce(existing.response_xml, ''));
  end if;

  if existing.started_at < now() - interval '30 seconds' then
    update private.whatsapp_order_messages
    set started_at = now()
    where message_sid = requested_message_sid;
    return jsonb_build_object('process', true, 'retried', true);
  end if;

  if existing.created_at <> existing.started_at then
    return jsonb_build_object('process', false, 'response_xml', '');
  end if;

  update private.whatsapp_order_messages
  set started_at = clock_timestamp()
  where message_sid = requested_message_sid;
  return jsonb_build_object('process', true, 'retried', false);
end;
$$;

create or replace function public.server_complete_whatsapp_order_message(
  requested_message_sid text,
  requested_phone_hmac text,
  requested_response_xml text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if char_length(coalesce(requested_response_xml, '')) > 8000 then
    raise exception 'Resposta de mensagem muito grande' using errcode = '22023';
  end if;
  update private.whatsapp_order_messages
  set status = 'completed',
      response_xml = requested_response_xml,
      completed_at = now()
  where message_sid = requested_message_sid
    and phone_hmac = requested_phone_hmac;
end;
$$;

create or replace function public.server_get_whatsapp_order_conversation(
  requested_phone_hmac text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  conversation private.whatsapp_order_conversations%rowtype;
begin
  delete from private.whatsapp_order_conversations
  where phone_hmac = requested_phone_hmac and expires_at <= now();

  select * into conversation
  from private.whatsapp_order_conversations
  where phone_hmac = requested_phone_hmac;

  if not found then return null; end if;
  return jsonb_build_object(
    'step', conversation.step,
    'state', conversation.state,
    'expires_at', conversation.expires_at
  );
end;
$$;

create or replace function public.server_save_whatsapp_order_conversation(
  requested_phone_hmac text,
  requested_phone_last4 text,
  requested_step text,
  requested_state jsonb,
  requested_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(requested_phone_hmac, '') !~ '^[a-f0-9]{64}$'
     or coalesce(requested_phone_last4, '') !~ '^[0-9]{4}$'
     or requested_step not in (
       'choose_items', 'name', 'sauce', 'payment', 'pickup_method',
       'pickup_time', 'confirm', 'handoff', 'completed'
     )
     or jsonb_typeof(requested_state) <> 'object'
     or octet_length(requested_state::text) > 20000
     or requested_expires_at <= now() + interval '1 minute'
     or requested_expires_at > now() + interval '25 hours' then
    raise exception 'Estado de conversa invalido' using errcode = '22023';
  end if;

  insert into private.whatsapp_order_conversations(
    phone_hmac, phone_last4, step, state, expires_at
  ) values (
    requested_phone_hmac, requested_phone_last4, requested_step,
    requested_state, requested_expires_at
  )
  on conflict (phone_hmac) do update set
    phone_last4 = excluded.phone_last4,
    step = excluded.step,
    state = excluded.state,
    expires_at = excluded.expires_at,
    updated_at = now();
end;
$$;

create or replace function public.server_clear_whatsapp_order_conversation(
  requested_phone_hmac text
)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.whatsapp_order_conversations where phone_hmac = requested_phone_hmac;
$$;

create or replace function public.server_get_whatsapp_order_catalog()
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  with local_day as (
    select (now() at time zone 'America/Fortaleza')::date as service_date
  ), available_flavors as (
    select
      flavor.id,
      flavor.name,
      flavor.base_price,
      flavor.sort_order,
      coalesce(sum(batch.quantity_free), 0)::integer as quantity_free,
      coalesce(jsonb_agg(jsonb_build_object(
        'available_from', to_char(batch.available_from, 'HH24:MI'),
        'quantity_free', batch.quantity_free
      ) order by batch.available_from) filter (where batch.id is not null), '[]'::jsonb) as batches
    from public.flavors flavor
    cross join local_day
    left join public.get_public_flavor_availability_batches(local_day.service_date) batch
      on batch.flavor_id = flavor.id
    where flavor.active and flavor.base_price is not null
    group by flavor.id, flavor.name, flavor.base_price, flavor.sort_order
  )
  select jsonb_build_object(
    'service_date', to_char(local_day.service_date, 'YYYY-MM-DD'),
    'flavors', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', flavor.id,
        'name', flavor.name,
        'price', flavor.base_price,
        'free', flavor.quantity_free,
        'batches', flavor.batches
      ) order by flavor.sort_order, flavor.name)
      from available_flavors flavor where flavor.quantity_free > 0
    ), '[]'::jsonb),
    'sauces', coalesce((
      select jsonb_agg(jsonb_build_object('code', sauce.id, 'label', sauce.name)
        order by sauce.sort_order, sauce.name)
      from public.order_sauces sauce where sauce.active
    ), '[]'::jsonb),
    'payment_methods', coalesce((
      select jsonb_agg(jsonb_build_object('code', method.code, 'label', method.label)
        order by method.sort_order, method.label)
      from public.payment_methods method where method.active and method.customer_selectable
    ), '[]'::jsonb)
  )
  from local_day;
$$;

create or replace function public.server_submit_whatsapp_order(
  requested_operation_key uuid,
  requested_customer_name text,
  requested_customer_phone text,
  requested_items jsonb,
  requested_payment_method text,
  requested_pickup_time time without time zone,
  requested_pickup_method text
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.submit_instant_order_v7(
    requested_operation_key,
    requested_customer_name,
    requested_customer_phone,
    requested_items,
    'Pedido automatizado pelo WhatsApp',
    requested_payment_method,
    null::jsonb,
    requested_pickup_time,
    requested_pickup_method
  );
$$;

revoke all on function public.server_begin_whatsapp_order_message(text,text)
  from public, anon, authenticated;
revoke all on function public.server_complete_whatsapp_order_message(text,text,text)
  from public, anon, authenticated;
revoke all on function public.server_get_whatsapp_order_conversation(text)
  from public, anon, authenticated;
revoke all on function public.server_save_whatsapp_order_conversation(text,text,text,jsonb,timestamptz)
  from public, anon, authenticated;
revoke all on function public.server_clear_whatsapp_order_conversation(text)
  from public, anon, authenticated;
revoke all on function public.server_get_whatsapp_order_catalog()
  from public, anon, authenticated;
revoke all on function public.server_submit_whatsapp_order(uuid,text,text,jsonb,text,time,text)
  from public, anon, authenticated;

grant execute on function public.server_begin_whatsapp_order_message(text,text) to service_role;
grant execute on function public.server_complete_whatsapp_order_message(text,text,text) to service_role;
grant execute on function public.server_get_whatsapp_order_conversation(text) to service_role;
grant execute on function public.server_save_whatsapp_order_conversation(text,text,text,jsonb,timestamptz) to service_role;
grant execute on function public.server_clear_whatsapp_order_conversation(text) to service_role;
grant execute on function public.server_get_whatsapp_order_catalog() to service_role;
grant execute on function public.server_submit_whatsapp_order(uuid,text,text,jsonb,text,time,text) to service_role;

commit;
