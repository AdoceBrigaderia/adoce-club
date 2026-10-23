begin;

-- Bug real reportado pelo proprietario: toda baixa manual de fidelidade (e
-- qualquer venda totalmente coberta por fidelidade ou desconto de 100%,
-- ficando em R$ 0,00) dava erro. Causa raiz: staff_create_manual_sale_in_cash_v5
-- sempre tentava gravar um cash_movements de 'sale/in' no valor final da
-- venda, mesmo quando esse valor e zero - e cash_movements tem
-- "CHECK (amount > 0)". O INSERT falhava sempre, 100% reproduzivel
-- (simulado e confirmado numa transacao sem efeito, nunca commitada).
--
-- Correcao: so grava o movimento de caixa quando o valor final e maior que
-- zero. Uma venda 100% coberta por fidelidade/desconto nao movimenta
-- dinheiro nenhum, entao nao ha "sale/in" nenhum pra registrar - isso ja
-- era verdade antes, so o INSERT incondicional que estava errado.

create or replace function public.staff_create_manual_sale_in_cash_v5(requested_operation_key uuid, target_session_id uuid, requested_customer_name text, requested_customer_phone text, requested_items jsonb, requested_payment_method text, requested_discount jsonb DEFAULT '{"kind": "none", "value": 0}'::jsonb, requested_payments jsonb DEFAULT '[]'::jsonb, requested_notes text DEFAULT ''::text, requested_change jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid := (select auth.uid());
  session_row public.cash_sessions%rowtype;
  sale_result jsonb;
  target public.instant_orders%rowtype;
  v_subtotal numeric(10,2);
  discount_kind text := coalesce(requested_discount->>'kind','none');
  discount_value numeric := greatest(0, coalesce((requested_discount->>'value')::numeric,0));
  v_discount_amount numeric(10,2);
  v_final_total numeric(10,2);
  v_paid numeric(10,2);
  v_change numeric(10,2);
  allocations jsonb := coalesce(requested_payments,'[]'::jsonb);
  allocation jsonb;
  method_code text;
  amount numeric;
  response jsonb;
  pix_change numeric := round(coalesce((requested_change->>'pix')::numeric,0),2);
  change_source text := left(btrim(coalesce(requested_change->>'source','Conta pessoal')),100);
begin
  if actor_id is null or not private.is_staff() then raise exception 'Acesso nao autorizado'; end if;
  if requested_operation_key is null then raise exception 'Chave de idempotencia invalida'; end if;
  select * into session_row from public.cash_sessions where id=target_session_id and status='open' for update;
  if session_row.id is null then raise exception 'O caixa nao esta aberto'; end if;
  perform pg_advisory_xact_lock(hashtextextended('staff:manual-sale-v3:'||requested_operation_key::text,0));
  select response_payload into response from private.staff_operation_requests where action='manual_sale_in_cash_v3' and operation_key=requested_operation_key and actor_user_id=actor_id;
  if response is not null then return response || jsonb_build_object('idempotent',true); end if;
  sale_result := public.staff_create_manual_sale(requested_customer_name, requested_customer_phone, requested_items, requested_payment_method, requested_notes);
  select * into target from public.instant_orders where id=nullif(sale_result->>'order_id','')::uuid for update;
  if target.id is null then raise exception 'A venda foi criada sem identificacao do pedido'; end if;
  v_subtotal := target.total;
  v_discount_amount := case when discount_kind='percent' then least(v_subtotal, round(v_subtotal*least(discount_value,100)/100,2)) when discount_kind='amount' then least(v_subtotal,round(discount_value,2)) else 0 end;
  v_final_total := greatest(0, round(v_subtotal-v_discount_amount,2));
  v_paid := 0;
  if jsonb_typeof(allocations)='array' then
    for allocation in select * from jsonb_array_elements(allocations) loop
      method_code := btrim(coalesce(allocation->>'method',''));
      amount := round(greatest(0,coalesce((allocation->>'amount')::numeric,0)),2);
      if amount <= 0 then continue; end if;
      if not exists(select 1 from public.payment_methods p where p.code=method_code and p.active) then raise exception 'Meio de pagamento indisponivel'; end if;
      v_paid := v_paid + amount;
      insert into public.cash_movements(cash_session_id,store_id,register_id,kind,direction,payment_method_code,amount,order_id,notes,created_by)
      values(session_row.id,session_row.store_id,session_row.register_id,'sale','in',method_code,amount,target.id,left(coalesce(requested_notes,''),1000),actor_id);
    end loop;
  end if;
  if v_paid=0 then
    v_paid := v_final_total;
    allocations := jsonb_build_array(jsonb_build_object('method',requested_payment_method,'amount',v_final_total));
    if v_final_total > 0 then
      insert into public.cash_movements(cash_session_id,store_id,register_id,kind,direction,payment_method_code,amount,order_id,notes,created_by)
      values(session_row.id,session_row.store_id,session_row.register_id,'sale','in',requested_payment_method,v_final_total,target.id,left(coalesce(requested_notes,''),1000),actor_id);
    end if;
  end if;
  v_paid := round(v_paid,2); v_change := greatest(0,round(v_paid-v_final_total,2));
  if pix_change < 0 or pix_change > v_change then raise exception 'Revise o troco por Pix'; end if;
  if pix_change > 0 and change_source='' then raise exception 'Informe a conta usada no troco por Pix'; end if;
  if v_change-pix_change > 0 then
    insert into public.cash_movements(cash_session_id,store_id,register_id,kind,direction,payment_method_code,amount,order_id,notes,created_by)
    values(session_row.id,session_row.store_id,session_row.register_id,'refund','out','cash',v_change-pix_change,target.id,'Troco da venda',actor_id);
  end if;
  update public.instant_orders set change_pix_amount=pix_change,change_pix_source=case when pix_change>0 then change_source else null end where id=target.id;
  update public.instant_orders set subtotal=target.subtotal,total=v_final_total,gross_amount=v_final_total,net_amount=v_final_total,discount_amount=v_discount_amount,amount_paid=v_paid,change_amount=v_change,payment_allocations=allocations,payment_status=case when v_paid>=v_final_total then 'approved' else 'pending' end,status=case when v_paid>=v_final_total then 'completed' else 'awaiting_payment' end,store_id=session_row.store_id,cash_register_id=session_row.register_id,cash_session_id=session_row.id,payment_recorded_at=case when v_paid>=v_final_total then now() else null end,updated_by=actor_id,updated_at=now() where id=target.id returning * into target;
  response := sale_result || jsonb_build_object('order_id',target.id,'order_number',target.order_number,'subtotal',target.subtotal,'total',target.total,'discount_amount',target.discount_amount,'amount_paid',target.amount_paid,'change_amount',target.change_amount,'remaining',greatest(0,target.total-target.amount_paid),'payment_allocations',target.payment_allocations,'completed',target.status='completed');
  insert into private.staff_operation_requests(action,operation_key,request_hash,response_payload,actor_user_id) values('manual_sale_in_cash_v3',requested_operation_key,encode(extensions.digest(coalesce(requested_items,'null'::jsonb)::text||coalesce(requested_notes,''),'sha256'),'hex'),response,actor_id);
  return response;
end;
$function$;

commit;
