begin;

create table public.costing_suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 160),
  created_by uuid,
  created_at timestamptz not null default now()
);
create unique index costing_suppliers_name_idx on public.costing_suppliers (lower(btrim(name)));
alter table public.costing_suppliers enable row level security;
revoke all on public.costing_suppliers from public, anon, authenticated;
grant all on public.costing_suppliers to service_role;

insert into public.costing_suppliers(name)
select min(btrim(supplier_name)) from public.costing_purchase_invoices
group by lower(btrim(supplier_name));

alter table public.costing_purchase_invoices
  add column supplier_id uuid references public.costing_suppliers(id) on delete restrict;
update public.costing_purchase_invoices invoice set supplier_id = supplier.id
from public.costing_suppliers supplier
where lower(btrim(invoice.supplier_name)) = lower(btrim(supplier.name));
alter table public.costing_purchase_invoices alter column supplier_id set not null;
create index costing_purchase_invoices_supplier_date_idx
  on public.costing_purchase_invoices(supplier_id, issued_on desc);

create or replace function private.costing_link_invoice_supplier()
returns trigger language plpgsql set search_path = '' as $$
declare saved_supplier public.costing_suppliers%rowtype;
begin
  if length(btrim(coalesce(new.supplier_name, ''))) not between 1 and 160 then
    raise exception 'Informe um fornecedor válido';
  end if;
  insert into public.costing_suppliers(name, created_by)
  values (btrim(new.supplier_name), (select auth.uid())) on conflict do nothing;
  select * into saved_supplier from public.costing_suppliers
  where lower(btrim(name)) = lower(btrim(new.supplier_name));
  if saved_supplier.id is null then raise exception 'Fornecedor não encontrado'; end if;
  new.supplier_id := saved_supplier.id;
  new.supplier_name := saved_supplier.name;
  return new;
end;
$$;
create trigger costing_link_invoice_supplier
  before insert or update of supplier_name on public.costing_purchase_invoices
  for each row execute function private.costing_link_invoice_supplier();

create or replace function public.manager_get_costing_suppliers()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_manager() then raise exception 'Apenas proprietários e gerentes podem consultar fornecedores'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id', supplier.id, 'name', supplier.name,
    'invoice_count', (select count(*) from public.costing_purchase_invoices invoice where invoice.supplier_id = supplier.id),
    'last_purchase', (select max(invoice.issued_on) from public.costing_purchase_invoices invoice where invoice.supplier_id = supplier.id)
  ) order by supplier.name) from public.costing_suppliers supplier), '[]'::jsonb);
end;
$$;

create or replace function public.manager_create_costing_supplier(next_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare saved_supplier public.costing_suppliers%rowtype;
begin
  if not private.is_manager() then raise exception 'Apenas proprietários e gerentes podem cadastrar fornecedores'; end if;
  if length(btrim(coalesce(next_name, ''))) not between 1 and 160 then raise exception 'Informe um nome de fornecedor válido'; end if;
  insert into public.costing_suppliers(name, created_by)
  values (btrim(next_name), (select auth.uid())) on conflict do nothing;
  select * into saved_supplier from public.costing_suppliers
  where lower(btrim(name)) = lower(btrim(next_name));
  return jsonb_build_object('id', saved_supplier.id, 'name', saved_supplier.name);
end;
$$;
revoke all on function public.manager_get_costing_suppliers() from public, anon, authenticated;
revoke all on function public.manager_create_costing_supplier(text) from public, anon, authenticated;
grant execute on function public.manager_get_costing_suppliers() to authenticated;
grant execute on function public.manager_create_costing_supplier(text) to authenticated;

comment on table public.costing_suppliers is 'Fornecedores da operação vinculados às notas de compra; sem controle de estoque.';
commit;
