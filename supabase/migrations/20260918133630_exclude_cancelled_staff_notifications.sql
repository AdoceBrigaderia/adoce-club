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
      and exists (select 1 from public.instant_orders orders where orders.id = delivery.order_id and orders.status <> 'cancelled')
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
  from private.order_staff_notification_deliveries delivery
  where created_at >= now() - interval '7 days'
    and exists (select 1 from public.instant_orders orders where orders.id = delivery.order_id and orders.status <> 'cancelled');
$$;
