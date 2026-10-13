begin;

alter table public.costing_suppliers
  add column cnpj text,
  add column phone text,
  add column email text,
  add column postal_code text,
  add column street text,
  add column street_number text,
  add column address_extra text,
  add column district text,
  add column city text,
  add column state_code text,
  add column notes text,
  add column exclusive_salesperson boolean not null default false,
  add column salesperson_name text,
  add column salesperson_phone text,
  add column active boolean not null default true,
  add constraint costing_suppliers_cnpj_format check (cnpj is null or cnpj ~ '^[0-9]{14}$'),
  add constraint costing_suppliers_salesperson_complete check (
    not exclusive_salesperson or (nullif(btrim(salesperson_name),'') is not null and nullif(btrim(salesperson_phone),'') is not null)
  );
create unique index costing_suppliers_cnpj_unique on public.costing_suppliers(cnpj) where cnpj is not null;

alter table public.costing_purchase_invoices
  add column invoice_kind text not null default 'cost_adjustment',
  add column purchased_on date,
  add column payment_method text,
  add column payment_state text not null default 'unknown',
  add column paid_on date,
  add column paid_amount_cents bigint,
  add column due_on date,
  add column financial_source_id uuid,
  add column financial_version integer not null default 1,
  add column financial_updated_at timestamptz not null default now(),
  add constraint costing_invoice_kind_check check (invoice_kind in ('real','cost_adjustment')),
  add constraint costing_invoice_payment_check check (
    invoice_kind = 'cost_adjustment' or (
      purchased_on is not null and nullif(btrim(payment_method),'') is not null and
      ((payment_state = 'paid' and paid_on is not null and paid_amount_cents > 0 and due_on is null) or
       (payment_state = 'payable' and due_on is not null and paid_on is null and paid_amount_cents is null))
    )
  );
update public.costing_purchase_invoices set financial_source_id=id where financial_source_id is null;
create unique index costing_invoice_active_source_unique
  on public.costing_purchase_invoices(financial_source_id) where replaced_by is null;
create index costing_invoice_financial_export_idx on public.costing_purchase_invoices(financial_updated_at,id)
  where invoice_kind='real' and replaced_by is null;

create function private.touch_costing_invoice_finance() returns trigger
language plpgsql set search_path='' as $fn$
begin
  if row(new.invoice_kind,new.purchased_on,new.payment_method,new.payment_state,new.paid_on,
         new.paid_amount_cents,new.due_on,new.archived_at,new.replaced_by)
     is distinct from
     row(old.invoice_kind,old.purchased_on,old.payment_method,old.payment_state,old.paid_on,
         old.paid_amount_cents,old.due_on,old.archived_at,old.replaced_by) then
    new.financial_updated_at:=clock_timestamp();
  end if;
  return new;
end $fn$;
create trigger touch_costing_invoice_finance before update on public.costing_purchase_invoices
for each row execute function private.touch_costing_invoice_finance();

create function private.touch_invoices_for_supplier() returns trigger
language plpgsql security definer set search_path='' as $fn$
begin
  if row(new.name,new.cnpj) is distinct from row(old.name,old.cnpj) then
    update public.costing_purchase_invoices set financial_updated_at=clock_timestamp()
    where supplier_id=new.id and invoice_kind='real' and replaced_by is null;
  end if;
  return new;
end $fn$;
create trigger touch_invoices_for_supplier after update on public.costing_suppliers
for each row execute function private.touch_invoices_for_supplier();

create or replace function public.manager_save_costing_supplier_details(p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare saved public.costing_suppliers%rowtype; cleaned_cnpj text;
begin
  if not private.is_manager() then raise exception 'Apenas proprietários e gerentes podem cadastrar fornecedores' using errcode='42501'; end if;
  cleaned_cnpj:=regexp_replace(coalesce(p_input->>'cnpj',''),'[^0-9]','','g');
  if length(cleaned_cnpj)<>14 then raise exception 'Informe um CNPJ válido'; end if;
  if length(btrim(coalesce(p_input->>'name',''))) not between 1 and 160 then raise exception 'Informe o nome do fornecedor'; end if;
  if nullif(btrim(coalesce(p_input->>'postal_code','')),'') is null or
     nullif(btrim(coalesce(p_input->>'street','')),'') is null or
     nullif(btrim(coalesce(p_input->>'street_number','')),'') is null or
     nullif(btrim(coalesce(p_input->>'district','')),'') is null or
     nullif(btrim(coalesce(p_input->>'city','')),'') is null or
     length(coalesce(p_input->>'state_code',''))<>2 then
    raise exception 'Complete o endereço do fornecedor';
  end if;
  if p_input->>'id' is not null then
    select * into saved from public.costing_suppliers where id=(p_input->>'id')::uuid for update;
    if saved.id is null then raise exception 'Fornecedor não encontrado'; end if;
  else
    select * into saved from public.costing_suppliers where lower(btrim(name))=lower(btrim(p_input->>'name')) for update;
    if saved.id is null then
      insert into public.costing_suppliers(name,created_by) values(btrim(p_input->>'name'),(select auth.uid())) returning * into saved;
    end if;
  end if;
  update public.costing_suppliers set
    name=btrim(p_input->>'name'),cnpj=cleaned_cnpj,phone=nullif(btrim(p_input->>'phone'),''),
    email=nullif(btrim(p_input->>'email'),''),postal_code=regexp_replace(p_input->>'postal_code','[^0-9]','','g'),
    street=btrim(p_input->>'street'),street_number=btrim(p_input->>'street_number'),
    address_extra=nullif(btrim(p_input->>'address_extra'),''),district=btrim(p_input->>'district'),
    city=btrim(p_input->>'city'),state_code=upper(btrim(p_input->>'state_code')),
    notes=nullif(btrim(p_input->>'notes'),''),
    exclusive_salesperson=coalesce((p_input->>'exclusive_salesperson')::boolean,false),
    salesperson_name=case when coalesce((p_input->>'exclusive_salesperson')::boolean,false) then nullif(btrim(p_input->>'salesperson_name'),'') else null end,
    salesperson_phone=case when coalesce((p_input->>'exclusive_salesperson')::boolean,false) then nullif(btrim(p_input->>'salesperson_phone'),'') else null end,
    active=coalesce((p_input->>'active')::boolean,true)
  where id=saved.id returning * into saved;
  return to_jsonb(saved);
end $fn$;

create or replace function public.manager_get_costing_supplier_details()
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
begin
  if not private.is_manager() then raise exception 'Acesso negado' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(s) order by s.name) from public.costing_suppliers s),'[]'::jsonb);
end $fn$;

create or replace function public.manager_save_costing_invoice_with_finance(p_invoice jsonb,p_lines jsonb)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare saved jsonb; inv public.costing_purchase_invoices%rowtype; old_inv public.costing_purchase_invoices%rowtype; kind text; state text;
begin
  if not private.is_manager() then raise exception 'Acesso negado' using errcode='42501'; end if;
  kind:=p_invoice->>'kind'; state:=p_invoice->>'payment_state';
  if kind not in ('real','cost_adjustment') then raise exception 'Escolha o tipo da nota'; end if;
  if p_invoice->>'target_invoice_id' is not null then
    select * into old_inv from public.costing_purchase_invoices where id=(p_invoice->>'target_invoice_id')::uuid for update;
    if old_inv.id is null then raise exception 'Nota original não encontrada'; end if;
    saved:=public.manager_edit_costing_purchase_invoice(
      old_inv.id,p_invoice->'expected_invoice',
      p_invoice->>'supplier_name',p_invoice->>'invoice_number',coalesce(p_invoice->>'series',''),
      (p_invoice->>'issued_on')::date,coalesce((p_invoice->>'discount_total')::numeric,0),
      coalesce((p_invoice->>'freight_total')::numeric,0),coalesce(p_invoice->>'notes',''),p_lines);
  else
    saved:=public.manager_save_costing_purchase_invoice_v2(
      p_invoice->>'supplier_name',p_invoice->>'invoice_number',coalesce(p_invoice->>'series',''),
      (p_invoice->>'issued_on')::date,coalesce((p_invoice->>'discount_total')::numeric,0),
      coalesce((p_invoice->>'freight_total')::numeric,0),coalesce(p_invoice->>'notes',''),p_lines);
  end if;
  select * into inv from public.costing_purchase_invoices where id=(saved->>'id')::uuid for update;
  if kind='real' and not exists(select 1 from public.costing_suppliers s where s.id=inv.supplier_id and s.active and s.cnpj is not null) then
    raise exception 'Complete o cadastro do fornecedor antes de registrar uma NF real';
  end if;
  update public.costing_purchase_invoices set
    invoice_kind=kind,purchased_on=nullif(p_invoice->>'purchased_on','')::date,
    payment_method=nullif(btrim(p_invoice->>'payment_method'),''),payment_state=coalesce(state,'unknown'),
    paid_on=nullif(p_invoice->>'paid_on','')::date,
    paid_amount_cents=nullif(p_invoice->>'paid_amount_cents','')::bigint,
    due_on=nullif(p_invoice->>'due_on','')::date,
    financial_source_id=coalesce(old_inv.financial_source_id,inv.id),
    financial_version=coalesce(old_inv.financial_version+1,1),financial_updated_at=clock_timestamp()
  where id=inv.id returning * into inv;
  return saved||jsonb_build_object('kind',inv.invoice_kind,'payment_state',inv.payment_state);
end $fn$;

create function public.manager_get_costing_invoice_finance()
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
begin
  if not private.is_manager() then raise exception 'Acesso negado' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',i.id,'kind',i.invoice_kind,'purchased_on',i.purchased_on,
    'payment_method',i.payment_method,'payment_state',i.payment_state,
    'paid_on',i.paid_on,'paid_amount_cents',i.paid_amount_cents,'due_on',i.due_on)
    ) from public.costing_purchase_invoices i where i.replaced_by is null and i.archived_at is null),'[]'::jsonb);
end $fn$;

create function public.topoint_supplier_invoice_export(
  p_token text,p_after_updated_at timestamptz default null,p_after_id uuid default null,p_limit integer default 100
) returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare items jsonb; last_row record;
begin
  if not exists(select 1 from private.topoint_export_grants g
    where g.active and g.token_hash=encode(extensions.digest(p_token,'sha256'),'hex')) then
    raise exception 'Integração não autorizada' using errcode='42501';
  end if;
  if p_limit not between 1 and 250 or (p_after_updated_at is null)<>(p_after_id is null) then
    raise exception 'Paginação inválida';
  end if;
  with page as (
    select i.*,s.name as current_supplier_name,s.cnpj
    from public.costing_purchase_invoices i join public.costing_suppliers s on s.id=i.supplier_id
    where i.invoice_kind='real' and i.replaced_by is null
      and (p_after_updated_at is null or (i.financial_updated_at,i.id)>(p_after_updated_at,p_after_id))
    order by i.financial_updated_at,i.id limit p_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'source_id',coalesce(p.financial_source_id,p.id),'row_id',p.id,'version',p.financial_version,'kind','real',
    'supplier',jsonb_build_object('id',p.supplier_id,'name',p.current_supplier_name,'cnpj',p.cnpj),
    'invoice_number',p.invoice_number,'series',p.series,'issued_on',p.issued_on,
    'purchased_on',p.purchased_on,'description',p.notes,
    'amount_cents',round(p.total_cost*100)::bigint,'payment_method',p.payment_method,
    'payment_state',p.payment_state,'paid_on',p.paid_on,'paid_amount_cents',p.paid_amount_cents,
    'due_on',p.due_on,'cancelled_at',p.archived_at,'updated_at',p.financial_updated_at)
    order by p.financial_updated_at,p.id),'[]'::jsonb) into items from page p;
  select i.financial_updated_at as updated_at,i.id from public.costing_purchase_invoices i
    where i.invoice_kind='real' and i.replaced_by is null
      and (p_after_updated_at is null or (i.financial_updated_at,i.id)>(p_after_updated_at,p_after_id))
    order by i.financial_updated_at,i.id offset p_limit-1 limit 1 into last_row;
  return jsonb_build_object('items',items,'next_updated_at',last_row.updated_at,
    'next_id',last_row.id,'exported_at',now());
end $fn$;

revoke all on function public.manager_save_costing_supplier_details(jsonb) from public,anon;
revoke all on function public.manager_get_costing_supplier_details() from public,anon;
revoke all on function public.manager_save_costing_invoice_with_finance(jsonb,jsonb) from public,anon;
revoke all on function public.manager_get_costing_invoice_finance() from public,anon;
revoke all on function public.topoint_supplier_invoice_export(text,timestamptz,uuid,integer) from public;
grant execute on function public.manager_save_costing_supplier_details(jsonb) to authenticated;
grant execute on function public.manager_get_costing_supplier_details() to authenticated;
grant execute on function public.manager_save_costing_invoice_with_finance(jsonb,jsonb) to authenticated;
grant execute on function public.manager_get_costing_invoice_finance() to authenticated;
grant execute on function public.topoint_supplier_invoice_export(text,timestamptz,uuid,integer) to anon,authenticated,service_role;
commit;
