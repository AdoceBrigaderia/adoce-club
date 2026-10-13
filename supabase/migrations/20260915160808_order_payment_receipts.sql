-- Comprovantes privados: receber nunca significa confirmar pagamento.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('order-payment-receipts','order-payment-receipts',false,16777216,array['image/jpeg','image/png','image/webp','application/pdf']);
-- Sem politica publica de leitura/escrita: arquivos acessados apenas pelo servidor.
create table private.order_payment_receipts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.instant_orders(id),
  phone_hmac text not null,
  message_sid text not null unique,
  storage_path text not null,
  content_type text not null check (content_type in ('image/jpeg','image/png','image/webp','application/pdf')),
  size_bytes integer not null check (size_bytes between 1 and 16777216),
  created_at timestamptz not null default clock_timestamp()
);
alter table private.order_payment_receipts enable row level security;
revoke all on private.order_payment_receipts from public,anon,authenticated;
create index order_payment_receipts_order on private.order_payment_receipts(order_id,created_at);
create index order_payment_receipts_pending on private.order_payment_receipts(phone_hmac) where order_id is null;

create or replace function public.server_save_order_receipt(requested_phone text, requested_phone_hmac text,
 requested_order_number text, requested_message_sid text, requested_storage_path text, requested_content_type text, requested_size_bytes integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ids uuid[]; numbers text[]; receipt private.order_payment_receipts%rowtype;
begin
  if requested_phone !~ '^\+55[0-9]{10,11}$' or length(requested_phone_hmac)<16
    or requested_storage_path not like 'receipts/%' then raise exception 'Comprovante invalido'; end if;
  select array_agg(o.id order by o.created_at desc),array_agg(o.order_number order by o.created_at desc)
  into ids,numbers from public.instant_orders o
  where regexp_replace(o.customer_phone,'[^0-9]','','g')=regexp_replace(requested_phone,'[^0-9]','','g')
    and o.created_at > now()-interval '30 days' and o.status <> 'cancelled'
    and (case when nullif(requested_order_number,'') is not null then o.order_number=requested_order_number
         else o.payment_method_code='pix' and o.payment_status <> 'approved' and o.status <> 'completed' end);
  insert into private.order_payment_receipts(order_id,phone_hmac,message_sid,storage_path,content_type,size_bytes)
  values(case when cardinality(ids)=1 then ids[1] end,requested_phone_hmac,requested_message_sid,requested_storage_path,requested_content_type,requested_size_bytes)
  on conflict(message_sid) do nothing returning * into receipt;
  if receipt.id is null then select * into receipt from private.order_payment_receipts where message_sid=requested_message_sid; end if;
  return jsonb_build_object('receipt_id',receipt.id,'order_number',(select order_number from public.instant_orders where id=receipt.order_id),
    'candidates',coalesce(to_jsonb(numbers),'[]'::jsonb));
end;
$$;
create or replace function public.server_link_order_receipts(requested_phone text,requested_phone_hmac text,requested_order_number text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target uuid; linked integer; target_message text;
begin
  select id into target from public.instant_orders
  where order_number=requested_order_number and created_at>now()-interval '30 days' and status<>'cancelled'
    and regexp_replace(customer_phone,'[^0-9]','','g')=regexp_replace(requested_phone,'[^0-9]','','g');
  if target is null then return jsonb_build_object('linked',0); end if;
  -- Uma resposta identifica somente o primeiro lote pendente, nunca todos os anexos do telefone.
  select regexp_replace(message_sid,'-[0-9]+$','') into target_message from private.order_payment_receipts
    where order_id is null and phone_hmac=requested_phone_hmac and created_at>now()-interval '24 hours'
    order by created_at,id limit 1 for update;
  update private.order_payment_receipts set order_id=target
  where order_id is null and phone_hmac=requested_phone_hmac and created_at>now()-interval '24 hours'
    and regexp_replace(message_sid,'-[0-9]+$','')=target_message;
  get diagnostics linked = row_count;
  return jsonb_build_object('linked',linked,'order_number',requested_order_number,
    'pending',(select count(*) from private.order_payment_receipts where order_id is null and phone_hmac=requested_phone_hmac and created_at>now()-interval '24 hours'));
end;
$$;
create or replace function public.server_list_order_receipts(requested_order_id uuid)
returns jsonb language sql security definer set search_path='' stable as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'storage_path',storage_path,'content_type',content_type,'created_at',created_at)
    order by created_at desc),'[]'::jsonb) from private.order_payment_receipts where order_id=requested_order_id;
$$;
revoke all on function public.server_save_order_receipt(text,text,text,text,text,text,integer) from public,anon,authenticated;
revoke all on function public.server_link_order_receipts(text,text,text) from public,anon,authenticated;
revoke all on function public.server_list_order_receipts(uuid) from public,anon,authenticated;
grant execute on function public.server_save_order_receipt(text,text,text,text,text,text,integer) to service_role;
grant execute on function public.server_link_order_receipts(text,text,text) to service_role;
grant execute on function public.server_list_order_receipts(uuid) to service_role;
