-- Supressao individual preserva pedido e historico.
create table private.order_customer_notification_suppressions (
 order_id uuid primary key references public.instant_orders(id),
 reason text not null,
 created_at timestamptz not null default now()
);
alter table private.order_customer_notification_suppressions enable row level security;
revoke all on private.order_customer_notification_suppressions from public,anon,authenticated;
create function private.suppress_order_customer_notice() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status in ('pending','processing') and exists(select 1 from private.order_customer_notification_suppressions where order_id=new.order_id) then
   new.status:='superseded'; new.last_error:='customer_notifications_disabled';
 end if;
 return new;
end; $$;
revoke all on function private.suppress_order_customer_notice() from public,anon,authenticated;
create trigger suppress_order_customer_notice before insert or update on private.order_customer_notifications
for each row execute function private.suppress_order_customer_notice();
create or replace function public.server_claim_order_customer_notice(requested_order_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target private.order_customer_notifications%rowtype; current_order public.instant_orders%rowtype; release_time time;
begin
  if exists(select 1 from private.order_customer_notification_suppressions where order_id=requested_order_id) then return null; end if;
  -- Serializa disparos concorrentes do mesmo pedido, preservando a ordem das etapas.
  select * into current_order from public.instant_orders where id=requested_order_id for update;
  update private.order_customer_notifications set status='superseded',updated_at=now()
    where order_id=requested_order_id and status in ('pending','failed') and stage<>current_order.status;
  update private.order_customer_notifications set status='uncertain',last_error='delivery_unknown',updated_at=now()
    where order_id=requested_order_id and status='processing' and updated_at<now()-interval '30 seconds';
  if exists(select 1 from private.order_customer_notifications where order_id=requested_order_id
    and (status='processing' or (stage=current_order.status and status in ('uncertain','failed')))) then return null; end if;
  select * into target from private.order_customer_notifications where order_id=requested_order_id and status='pending' order by id limit 1 for update;
  if not found then return null; end if;
  if target.stage='awaiting_payment' and current_order.separation_confirmed_at is null then
    update private.order_customer_notifications set status='failed',last_error='separation_required' where id=target.id;
    return null;
  end if;
  update private.order_customer_notifications set status='processing',attempts=attempts+1,updated_at=now() where id=target.id;
  select max(b.available_from) into release_time from private.instant_order_batch_allocations a
    join public.instant_order_items i on i.id=a.order_item_id
    join public.flavor_availability_batches b on b.id=a.batch_id
    where i.order_id=requested_order_id and a.status='reserved';
  if release_time is null then
    select max(first_batch) into release_time from (
      select min(b.available_from) first_batch from public.instant_order_items i
      join public.flavor_availability_batches b on b.flavor_id=i.flavor_id
      where i.order_id=requested_order_id and b.service_date=(now() at time zone 'America/Fortaleza')::date
        and b.active and b.quantity_available>b.quantity_reserved group by i.flavor_id
    ) availability;
  end if;
  return jsonb_build_object('id',target.id,'attempt',target.attempts+1,'snapshot',target.snapshot || jsonb_build_object('available_from',release_time,
    'total',current_order.total,'payment_url',current_order.payment_url,'payment_method_code',current_order.payment_method_code));
end;
$$;
