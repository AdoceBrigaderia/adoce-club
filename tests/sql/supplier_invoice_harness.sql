-- Run in a disposable PostgreSQL 17 database before the new migration and checks.
-- Minimal stubs validate new SQL behavior; they do not replace full Supabase acceptance.
create schema auth;
create schema private;
create schema extensions;
create extension pgcrypto with schema extensions;
create function auth.uid() returns uuid language sql stable as $$ select '10000000-0000-4000-8000-000000000001'::uuid $$;
create function private.is_manager() returns boolean language sql stable as $$ select true $$;
create table public.costing_suppliers (
  id uuid primary key default gen_random_uuid(),name text not null unique,
  created_by uuid,created_at timestamptz not null default now()
);
create table public.costing_purchase_invoices (
  id uuid primary key default gen_random_uuid(),supplier_id uuid not null references public.costing_suppliers(id),
  supplier_name text not null,invoice_number text not null,series text not null default '',
  issued_on date not null,subtotal numeric not null default 100,discount_total numeric not null default 0,
  freight_total numeric not null default 0,total_cost numeric not null default 100,notes text,
  created_by uuid,created_at timestamptz not null default now(),archived_at timestamptz,
  replaced_by uuid
);
create function public.manager_save_costing_purchase_invoice_v2(
  next_supplier_name text,next_invoice_number text,next_series text,next_issued_on date,
  next_discount_total numeric,next_freight_total numeric,next_notes text,next_lines jsonb
) returns jsonb language plpgsql as $fn$
declare supplier public.costing_suppliers%rowtype; saved public.costing_purchase_invoices%rowtype;
begin
  select * into supplier from public.costing_suppliers where name=next_supplier_name;
  if supplier.id is null then raise exception 'Fornecedor ausente'; end if;
  insert into public.costing_purchase_invoices(supplier_id,supplier_name,invoice_number,series,issued_on,
    discount_total,freight_total,notes,total_cost)
  values(supplier.id,supplier.name,next_invoice_number,next_series,next_issued_on,
    next_discount_total,next_freight_total,next_notes,100)
  returning * into saved;
  return to_jsonb(saved);
end $fn$;
create function public.manager_edit_costing_purchase_invoice(
  target_invoice_id uuid,expected_invoice jsonb,next_supplier_name text,next_invoice_number text,
  next_series text,next_issued_on date,next_discount_total numeric,next_freight_total numeric,
  next_notes text,next_lines jsonb
) returns jsonb language plpgsql as $fn$
declare saved jsonb;
begin
  saved:=public.manager_save_costing_purchase_invoice_v2(next_supplier_name,next_invoice_number,
    next_series,next_issued_on,next_discount_total,next_freight_total,next_notes,next_lines);
  update public.costing_purchase_invoices set archived_at=now(),replaced_by=(saved->>'id')::uuid
  where id=target_invoice_id;
  return saved;
end $fn$;
