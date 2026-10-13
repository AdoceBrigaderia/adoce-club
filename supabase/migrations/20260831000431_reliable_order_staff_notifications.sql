begin;

create extension if not exists pg_net with schema extensions;

create table if not exists private.order_staff_notification_deliveries (
  order_id uuid not null references public.instant_orders(id) on delete cascade,
  recipient_key text not null check (recipient_key in ('rubens', 'beth')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'accepted', 'delivered', 'failed')),
  attempts integer not null default 0 check (attempts between 0 and 10),
  message_sid text unique,
  last_error text,
  accepted_at timestamptz,
  delivered_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (order_id, recipient_key)
);

create index if not exists order_staff_notifications_status_idx
  on private.order_staff_notification_deliveries(status, updated_at);

revoke all on table private.order_staff_notification_deliveries from public, anon, authenticated;
grant select, insert, update, delete on table private.order_staff_notification_deliveries to service_role;

comment on table private.order_staff_notification_deliveries is
  'Entrega individual e auditavel do aviso de cada pedido online para Rubens e Beth.';

create or replace function public.server_claim_order_staff_notifications(
  requested_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed jsonb;
begin
  with candidates as (
    select delivery.order_id, delivery.recipient_key
    from private.order_staff_notification_deliveries delivery
    where delivery.order_id = requested_order_id
      and (
        delivery.status in ('pending', 'failed')
        or (delivery.status = 'processing' and delivery.updated_at < now() - interval '2 minutes')
      )
      and delivery.attempts < 5
    for update skip locked
  ), updated as (
    update private.order_staff_notification_deliveries delivery
    set status = 'processing', attempts = delivery.attempts + 1,
        last_error = null, updated_at = now()
    from candidates
    where delivery.order_id = candidates.order_id
      and delivery.recipient_key = candidates.recipient_key
    returning delivery.recipient_key, delivery.attempts
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'recipient_key', updated.recipient_key,
    'attempt', updated.attempts
  ) order by updated.recipient_key), '[]'::jsonb)
  into claimed
  from updated;
  return claimed;
end;
$$;

create or replace function public.server_complete_order_staff_notification(
  requested_order_id uuid,
  requested_recipient_key text,
  requested_status text,
  requested_message_sid text default null,
  requested_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if requested_recipient_key not in ('rubens', 'beth')
     or requested_status not in ('accepted', 'delivered', 'failed') then
    raise exception 'Resultado de notificacao invalido' using errcode = '22023';
  end if;
  update private.order_staff_notification_deliveries
  set status = requested_status,
      message_sid = coalesce(requested_message_sid, message_sid),
      last_error = left(requested_error, 500),
      accepted_at = case when requested_status = 'accepted' then now() else accepted_at end,
      delivered_at = case when requested_status = 'delivered' then now() else delivered_at end,
      updated_at = now()
  where order_id = requested_order_id
    and recipient_key = requested_recipient_key;
end;
$$;

create or replace function public.server_update_order_staff_notification_status(
  requested_message_sid text,
  requested_status text,
  requested_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if requested_status not in ('accepted', 'delivered', 'failed') then
    raise exception 'Status de notificacao invalido' using errcode = '22023';
  end if;
  update private.order_staff_notification_deliveries
  set status = requested_status,
      last_error = left(requested_error, 500),
      delivered_at = case when requested_status = 'delivered' then now() else delivered_at end,
      updated_at = now()
  where message_sid = requested_message_sid;
end;
$$;

create or replace function public.server_get_order_staff_notification_health()
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'pending', count(*) filter (where status in ('pending', 'processing')),
    'failed', count(*) filter (where status = 'failed'),
    'last_failure', max(updated_at) filter (where status = 'failed')
  )
  from private.order_staff_notification_deliveries
  where created_at >= now() - interval '7 days';
$$;

create or replace function private.dispatch_online_order_staff_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  webhook_url text;
  webhook_secret text;
begin
  if coalesce(new.sales_channel, '') = 'operation' then return new; end if;

  insert into private.order_staff_notification_deliveries(order_id, recipient_key)
  values (new.id, 'rubens'), (new.id, 'beth')
  on conflict (order_id, recipient_key) do nothing;

  select decrypted_secret into webhook_url
  from vault.decrypted_secrets where name = 'order_notification_webhook_url'
  order by created_at desc limit 1;
  select decrypted_secret into webhook_secret
  from vault.decrypted_secrets where name = 'order_notification_webhook_secret'
  order by created_at desc limit 1;

  if coalesce(webhook_url, '') <> '' and coalesce(webhook_secret, '') <> '' then
    perform net.http_post(
      url := webhook_url,
      body := jsonb_build_object('event', 'instant_order.created', 'order_id', new.id),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Adoce-Webhook-Secret', webhook_secret
      ),
      timeout_milliseconds := 10000
    );
  else
    update private.order_staff_notification_deliveries
    set status = 'failed', last_error = 'Webhook de pedidos nao configurado no Vault', updated_at = now()
    where order_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists dispatch_online_order_staff_notification on public.instant_orders;
create trigger dispatch_online_order_staff_notification
after insert on public.instant_orders
for each row execute function private.dispatch_online_order_staff_notification();

create or replace function private.instant_order_operation_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.operation_notifications(event_type, priority, title, message, action_url, entity_type, entity_id)
    values ('instant_order.created',
      case when new.checkout_mode = 'automatic' then 'urgent' else 'important' end,
      'Novo pedido de fatias',
      new.order_number || ' · ' || new.customer_name || ' · ' || new.total::text,
      '/operacao/pedidos?tipo=vendas',
      'instant_order', new.id);
  elsif new.status is distinct from old.status then
    insert into public.operation_notifications(event_type, priority, title, message, action_url, entity_type, entity_id)
    values ('instant_order.status_changed', 'important', 'Pedido atualizado',
      new.order_number || ' agora está como ' || new.status,
      '/operacao/pedidos?tipo=vendas',
      'instant_order', new.id);
  end if;
  return new;
end;
$$;

revoke all on function public.server_claim_order_staff_notifications(uuid)
  from public, anon, authenticated;
revoke all on function public.server_complete_order_staff_notification(uuid,text,text,text,text)
  from public, anon, authenticated;
revoke all on function public.server_update_order_staff_notification_status(text,text,text)
  from public, anon, authenticated;
revoke all on function public.server_get_order_staff_notification_health()
  from public, anon, authenticated;
revoke all on function private.dispatch_online_order_staff_notification()
  from public, anon, authenticated;
revoke all on function private.instant_order_operation_notification()
  from public, anon, authenticated;

grant execute on function public.server_claim_order_staff_notifications(uuid) to service_role;
grant execute on function public.server_complete_order_staff_notification(uuid,text,text,text,text) to service_role;
grant execute on function public.server_update_order_staff_notification_status(text,text,text) to service_role;
grant execute on function public.server_get_order_staff_notification_health() to service_role;

commit;
