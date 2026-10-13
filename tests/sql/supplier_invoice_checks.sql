create table private.topoint_export_grants(token_hash text not null,active boolean not null default true);
insert into private.topoint_export_grants values(encode(extensions.digest('test-token','sha256'),'hex'),true);
do $test$
declare supplier jsonb; payable jsonb; paid jsonb; adjustment jsonb; revised jsonb; export jsonb;
begin
  supplier:=public.manager_save_costing_supplier_details('{"name":"Fornecedor Teste","cnpj":"11222333000181","postal_code":"60000000","street":"Rua Teste","street_number":"10","district":"Centro","city":"Fortaleza","state_code":"CE","exclusive_salesperson":true,"salesperson_name":"João","salesperson_phone":"85999999999"}');
  if supplier->>'cnpj' <> '11222333000181' then raise exception 'supplier CNPJ lost'; end if;
  payable:=public.manager_save_costing_invoice_with_finance('{"kind":"real","supplier_name":"Fornecedor Teste","invoice_number":"NF-1","issued_on":"2026-10-06","purchased_on":"2026-10-05","payment_method":"Boleto","payment_state":"payable","due_on":"2026-10-10"}','[]');
  paid:=public.manager_save_costing_invoice_with_finance('{"kind":"real","supplier_name":"Fornecedor Teste","invoice_number":"NF-2","issued_on":"2026-10-06","purchased_on":"2026-10-05","payment_method":"Pix","payment_state":"paid","paid_on":"2026-10-05","paid_amount_cents":10000}','[]');
  adjustment:=public.manager_save_costing_invoice_with_finance('{"kind":"cost_adjustment","supplier_name":"Fornecedor Teste","invoice_number":"AJ-1","issued_on":"2026-10-06"}','[]');
  export:=public.topoint_supplier_invoice_export('test-token',null,null,100);
  if jsonb_array_length(export->'items')<>2 then raise exception 'adjustment exported or real note missing: %',export; end if;
  revised:=public.manager_save_costing_invoice_with_finance(jsonb_build_object(
    'target_invoice_id',payable->>'id','expected_invoice',payable,'kind','real','supplier_name','Fornecedor Teste',
    'invoice_number','NF-1','issued_on','2026-10-06','purchased_on','2026-10-05',
    'payment_method','Boleto','payment_state','payable','due_on','2026-10-12'),'[]');
  export:=public.topoint_supplier_invoice_export('test-token',null,null,100);
  if jsonb_array_length(export->'items')<>2 then raise exception 'edit duplicated export'; end if;
  if not exists(select 1 from jsonb_array_elements(export->'items') item
    where item->>'source_id'=payable->>'id' and item->>'version'='2' and item->>'due_on'='2026-10-12') then
    raise exception 'edit lost source identity or due date';
  end if;
  update public.costing_purchase_invoices set archived_at=now() where id=(revised->>'id')::uuid;
  export:=public.topoint_supplier_invoice_export('test-token',null,null,100);
  if not exists(select 1 from jsonb_array_elements(export->'items') item
    where item->>'source_id'=payable->>'id' and item->>'cancelled_at' is not null) then
    raise exception 'cancelled note not exported';
  end if;
  raise notice 'Adoce supplier and invoice export checks passed';
end $test$;
