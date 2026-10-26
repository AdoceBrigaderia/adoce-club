begin;

create or replace function public.server_get_order_staff_notification_health()
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  with relevant as (
    select
      delivery.order_id,
      orders.order_number,
      delivery.recipient_key,
      delivery.status,
      delivery.attempts,
      delivery.last_error,
      delivery.created_at,
      delivery.updated_at
    from private.order_staff_notification_deliveries delivery
    join public.instant_orders orders on orders.id = delivery.order_id
    where delivery.created_at >= now() - interval '7 days'
      and orders.status <> 'cancelled'
      and delivery.status in ('pending', 'processing', 'failed')
  )
  select jsonb_build_object(
    'pending', count(*) filter (where status in ('pending', 'processing')),
    'failed', count(*) filter (where status = 'failed'),
    'last_failure', max(updated_at) filter (where status = 'failed'),
    'issues', coalesce(jsonb_agg(
      jsonb_build_object(
        'order_id', order_id,
        'order_number', order_number,
        'recipient', recipient_key,
        'status', status,
        'attempts', attempts,
        'error', last_error,
        'created_at', created_at,
        'updated_at', updated_at
      ) order by updated_at desc
    ), '[]'::jsonb)
  )
  from relevant;
$$;

revoke all on function public.server_get_order_staff_notification_health()
  from public, anon, authenticated;
grant execute on function public.server_get_order_staff_notification_health()
  to service_role;

commit;
