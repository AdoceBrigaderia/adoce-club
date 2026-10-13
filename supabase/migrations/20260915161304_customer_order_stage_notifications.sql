-- Cada transicao confirmada gera seu proprio evento; repeticao do mesmo status nao gera envio.
alter table public.instant_orders add column if not exists separation_confirmed_at timestamptz;
create or replace function private.wait_for_charge_delivery() returns trigger language plpgsql set search_path='' as $$
begin
 if new.status='awaiting_payment' and (tg_op='INSERT' or old.status is distinct from new.status) then
   new.reserved_until:=null;new.payment_expires_at:=null;
 end if;
 return new;
end; $$;
revoke all on function private.wait_for_charge_delivery() from public,anon,authenticated;
create trigger zz_wait_for_charge_delivery before insert or update of status on public.instant_orders for each row execute function private.wait_for_charge_delivery();
create table private.order_customer_notifications (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.instant_orders(id),
  stage text not null,
  snapshot jsonb not null,
  status text not null default 'pending' check(status in ('pending','processing','accepted','delivered','read','failed','uncertain','superseded')),
  message_sid text unique,
  last_error text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table private.order_customer_notifications enable row level security;
revoke all on private.order_customer_notifications from public,anon,authenticated;
create index order_customer_notifications_queue on private.order_customer_notifications(order_id,id);

create or replace function private.enqueue_order_customer_stage() returns trigger
language plpgsql security definer set search_path='' as $$
declare secret text;
begin
  if tg_op='UPDATE' and new.status is not distinct from old.status then return new; end if;
  if nullif(new.customer_phone,'') is null then return new; end if;
  insert into private.order_customer_notifications(order_id,stage,snapshot)
  values(new.id,new.status,jsonb_build_object('customer_name',new.customer_name,'customer_phone',new.customer_phone,
    'order_number',new.order_number,'status',new.status,'payment_status',new.payment_status,'total',new.total,'payment_method_code',new.payment_method_code,
    'payment_url',new.payment_url,'pickup_label',new.pickup_label,'pickup_address',new.pickup_address));
  -- Falha de transporte nao desfaz uma venda; o evento fica visivel para nova tentativa.
  begin
    select decrypted_secret into secret from vault.decrypted_secrets where name='order_notification_webhook_secret' order by created_at desc limit 1;
    if nullif(secret,'') is not null then
      perform net.http_post(url:='https://www.adocebrigaderia.com.br/api/hooks/orders/customer-notify',
        body:=jsonb_build_object('order_id',new.id),headers:=jsonb_build_object('Content-Type','application/json','x-adoce-webhook-secret',secret));
    end if;
  exception when others then
    update private.order_customer_notifications set last_error='dispatch_unavailable' where order_id=new.id and status='pending';
  end;
  return new;
end;
$$;
create trigger instant_order_customer_stages after insert or update of status on public.instant_orders
for each row execute function private.enqueue_order_customer_stage();

create or replace function public.server_claim_order_customer_notice(requested_order_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target private.order_customer_notifications%rowtype; current_order public.instant_orders%rowtype; release_time time;
begin
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
create or replace function public.server_finish_order_customer_notice(requested_id bigint,requested_status text,requested_sid text default null,requested_error text default null,requested_attempt integer default 1) returns void
language plpgsql security definer set search_path='' as $$
begin
  if requested_status not in ('accepted','failed','uncertain') then raise exception 'Status invalido'; end if;
  update private.order_customer_notifications set status=case when status in ('delivered','read','failed') then status else requested_status end,
    message_sid=coalesce(requested_sid,message_sid),last_error=case when status='failed' then last_error else left(requested_error,100) end,updated_at=now()
    where id=requested_id and attempts=requested_attempt and status<>'pending';
end;
$$;
create or replace function public.server_customer_notice_callback(requested_id bigint,requested_sid text,requested_status text,requested_error text default null,requested_attempt integer default 1) returns void
language plpgsql security definer set search_path='' as $$
begin
  if requested_status not in ('accepted','delivered','read','failed') then return; end if;
  update private.order_customer_notifications set
    status=case when status='read' then status when status in ('delivered','failed') and requested_status='accepted' then status else requested_status end,
    message_sid=requested_sid,last_error=case when status='failed' and requested_status='accepted' then last_error else left(requested_error,100) end,updated_at=now()
  where id=requested_id and attempts=requested_attempt and status<>'pending' and (message_sid is null or message_sid=requested_sid);
  if found and requested_status in ('delivered','read') then
    update public.instant_orders o set reserved_until=now()+make_interval(mins=>private.current_instant_order_reservation_minutes()),
      payment_expires_at=now()+make_interval(mins=>private.current_instant_order_reservation_minutes())
    where o.id=(select order_id from private.order_customer_notifications where id=requested_id and stage='awaiting_payment')
      and o.status='awaiting_payment' and o.payment_status<>'approved' and o.reserved_until is null;
  end if;
end;
$$;
create or replace function public.staff_list_order_customer_notices(requested_order_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not private.is_staff() then raise exception 'Acesso nao autorizado'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'stage',stage,'status',status,'last_error',last_error,'created_at',created_at) order by id),'[]'::jsonb)
    from private.order_customer_notifications where order_id=requested_order_id);
end;
$$;
create or replace function public.staff_retry_order_customer_notices(requested_order_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not private.is_staff() then raise exception 'Acesso nao autorizado'; end if;
  -- Nao repete resultados incertos: uma requisicao pode ter sido aceita antes de perder a conexao.
  update private.order_customer_notifications set status='pending',message_sid=null,last_error=null,updated_at=now()
  where order_id=requested_order_id and status='failed' and attempts<5;
end;
$$;
revoke all on function private.enqueue_order_customer_stage() from public,anon,authenticated;
revoke all on function public.server_claim_order_customer_notice(uuid) from public,anon,authenticated;
revoke all on function public.server_finish_order_customer_notice(bigint,text,text,text,integer) from public,anon,authenticated;
revoke all on function public.server_customer_notice_callback(bigint,text,text,text,integer) from public,anon,authenticated;
revoke all on function public.staff_list_order_customer_notices(uuid) from public,anon;
revoke all on function public.staff_retry_order_customer_notices(uuid) from public,anon;
grant execute on function public.server_claim_order_customer_notice(uuid) to service_role;
grant execute on function public.server_finish_order_customer_notice(bigint,text,text,text,integer) to service_role;
grant execute on function public.server_customer_notice_callback(bigint,text,text,text,integer) to service_role;
grant execute on function public.staff_list_order_customer_notices(uuid) to authenticated;
grant execute on function public.staff_retry_order_customer_notices(uuid) to authenticated;

create or replace function public.staff_confirm_instant_order_separation(target_order_id uuid,next_payment_url text default null,next_internal_notes text default null)
returns public.instant_orders language plpgsql security definer set search_path='' as $$
declare target public.instant_orders%rowtype; result public.instant_orders%rowtype;
begin
  if auth.uid() is null or not private.is_staff() then raise exception 'Acesso nao autorizado'; end if;
  select * into target from public.instant_orders where id=target_order_id for update;
  if not found or target.status not in ('reserved','preparing','awaiting_payment') or target.payment_status='approved' then raise exception 'O pedido precisa estar reservado e ainda nao pago'; end if;
  if target.status='awaiting_payment' and target.separation_confirmed_at is not null then return target; end if;
  if target.payment_method_code<>'pix' and coalesce(next_payment_url,'') !~ '^https?://' then raise exception 'Informe o link para este meio de pagamento'; end if;
  update public.instant_orders set separation_confirmed_at=coalesce(separation_confirmed_at,now()) where id=target_order_id;
  result:=public.staff_update_instant_order(target_order_id,'awaiting_payment',next_payment_url,null,next_internal_notes,null);
  if target.separation_confirmed_at is null then
    update public.instant_orders set reserved_until=null,payment_expires_at=null where id=target_order_id returning * into result;
  end if;
  insert into private.order_customer_notifications(order_id,stage,snapshot)
    select target_order_id,'awaiting_payment',to_jsonb(result)
    where not exists(select 1 from private.order_customer_notifications where order_id=target_order_id and stage='awaiting_payment');
  -- Recupera cobranca criada por versao antiga sem confirmar separacao.
  update private.order_customer_notifications set status='pending',last_error=null
    where order_id=target_order_id and stage='awaiting_payment' and status='failed' and last_error='separation_required';
  insert into public.audit_events(actor_user_id,action,entity_type,entity_id,payload)
    values(auth.uid(),'instant_order.separation_confirmed','instant_order',target_order_id::text,jsonb_build_object('confirmed_at',result.separation_confirmed_at));
  return result;
end;
$$;
revoke all on function public.staff_confirm_instant_order_separation(uuid,text,text) from public,anon;
grant execute on function public.staff_confirm_instant_order_separation(uuid,text,text) to authenticated;
