begin;

create table public.costing_package_types (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 40),
  created_by uuid,
  created_at timestamptz not null default now()
);
create unique index costing_package_types_name_idx on public.costing_package_types(lower(btrim(name)));

create table public.costing_content_units (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 80),
  physical_quantity numeric(16,6) not null check (physical_quantity > 0),
  physical_unit text not null check (physical_unit in ('g', 'kg', 'ml', 'l', 'unit')),
  created_by uuid,
  created_at timestamptz not null default now()
);
create unique index costing_content_units_name_idx on public.costing_content_units(lower(btrim(name)));

alter table public.costing_package_types enable row level security;
alter table public.costing_content_units enable row level security;
revoke all on public.costing_package_types from public, anon, authenticated;
revoke all on public.costing_content_units from public, anon, authenticated;
grant all on public.costing_package_types to service_role;
grant all on public.costing_content_units to service_role;

alter table public.costing_purchase_invoice_lines
  add column outer_unit_price numeric(14,4) check (outer_unit_price is null or outer_unit_price >= 0),
  add column content_unit_catalog_id uuid references public.costing_content_units(id) on delete restrict,
  add column entered_content_quantity numeric(16,6) check (entered_content_quantity is null or entered_content_quantity > 0);
alter table public.costing_purchase_invoice_lines
  add constraint costing_invoice_outer_price_check
  check (outer_unit_price is null or gross_total = round(outer_unit_price * ((package_layers->0->>'quantity')::numeric), 4)) not valid;

create or replace function public.manager_get_costing_purchase_catalog()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_manager() then raise exception 'Apenas proprietários e gerentes podem consultar unidades de custo'; end if;
  return jsonb_build_object(
    'package_types', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name) order by p.name)
      from public.costing_package_types p), '[]'::jsonb),
    'content_units', coalesce((select jsonb_agg(jsonb_build_object(
      'id', u.id, 'name', u.name, 'physical_quantity', u.physical_quantity, 'physical_unit', u.physical_unit
    ) order by u.name) from public.costing_content_units u), '[]'::jsonb)
  );
end;
$$;

create or replace function public.manager_get_costing_purchase_workspace()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_manager() then raise exception 'Apenas proprietários e gerentes podem consultar notas de custo'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id', inv.id, 'supplier_name', inv.supplier_name, 'invoice_number', inv.invoice_number,
    'series', inv.series, 'issued_on', inv.issued_on, 'subtotal', inv.subtotal,
    'discount_total', inv.discount_total, 'freight_total', inv.freight_total,
    'total_cost', inv.total_cost, 'created_at', inv.created_at,
    'lines', coalesce((select jsonb_agg(jsonb_build_object(
      'id', purchase_line.id, 'line_number', purchase_line.line_number, 'item_id', purchase_line.item_id,
      'item_name', item.name, 'package_layers', purchase_line.package_layers,
      'content_quantity', purchase_line.content_quantity, 'content_unit', purchase_line.content_unit,
      'entered_content_quantity', purchase_line.entered_content_quantity,
      'content_presentation', content_unit.name,
      'outer_unit_price', purchase_line.outer_unit_price,
      'normalized_quantity', purchase_line.normalized_quantity, 'normalized_unit', purchase_line.normalized_unit,
      'useful_quantity', purchase_line.useful_quantity, 'gross_total', purchase_line.gross_total,
      'allocated_discount', purchase_line.allocated_discount, 'allocated_freight', purchase_line.allocated_freight,
      'net_total', purchase_line.net_total
    ) order by purchase_line.line_number) from public.costing_purchase_invoice_lines purchase_line
      join public.costing_items item on item.id = purchase_line.item_id
      left join public.costing_content_units content_unit on content_unit.id = purchase_line.content_unit_catalog_id
      where purchase_line.invoice_id = inv.id), '[]'::jsonb)
  ) order by inv.issued_on desc, inv.created_at desc)
  from public.costing_purchase_invoices inv), '[]'::jsonb);
end;
$$;

create or replace function public.manager_save_costing_purchase_invoice_v2(
  next_supplier_name text, next_invoice_number text, next_series text, next_issued_on date,
  next_discount_total numeric, next_freight_total numeric, next_notes text, next_lines jsonb
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  line jsonb;
  layer jsonb;
  normalized_line jsonb;
  normalized_lines jsonb := '[]'::jsonb;
  saved_invoice jsonb;
  saved_unit_id uuid;
  definition_quantity numeric;
  definition_unit text;
  content_count numeric;
  physical_content_quantity numeric;
  outer_count numeric;
  unit_price numeric;
  line_index integer := 0;
begin
  if not private.is_manager() then raise exception 'Apenas proprietários e gerentes podem cadastrar notas de custo'; end if;
  if jsonb_typeof(next_lines) is distinct from 'array' or jsonb_array_length(next_lines) not between 1 and 100 then
    raise exception 'A nota deve ter de 1 a 100 itens';
  end if;
  for line in select value from jsonb_array_elements(next_lines) value loop
    line_index := line_index + 1;
    if jsonb_typeof(line) is distinct from 'object' or jsonb_typeof(line->'package_layers') is distinct from 'array'
      or jsonb_array_length(line->'package_layers') not between 1 and 5 then
      raise exception 'Embalagem inválida na linha %', line_index;
    end if;
    outer_count := nullif(line->'package_layers'->0->>'quantity', '')::numeric;
    unit_price := nullif(line->>'unit_price', '')::numeric;
    if outer_count is null or outer_count <= 0 or mod(outer_count, 1) <> 0 or outer_count > 1000000 then
      raise exception 'Quantidade externa inválida na linha %', line_index;
    end if;
    if unit_price is null or unit_price < 0 or unit_price > 9999999999 or round(unit_price, 4) <> unit_price
      or unit_price * outer_count > 9999999999 then
      raise exception 'Preço unitário inválido na linha %', line_index;
    end if;
    for layer in select value from jsonb_array_elements(line->'package_layers') value loop
      if length(btrim(coalesce(layer->>'name', ''))) not between 1 and 40 then
        raise exception 'Tipo de embalagem inválido na linha %', line_index;
      end if;
      insert into public.costing_package_types(name, created_by)
      values (btrim(layer->>'name'), (select auth.uid())) on conflict do nothing;
    end loop;

    content_count := nullif(line->>'content_quantity', '')::numeric;
    if content_count is null or content_count <= 0 or content_count > 999999999 then
      raise exception 'Conteúdo inválido na linha %', line_index;
    end if;
    saved_unit_id := null;
    if nullif(line->>'content_unit_catalog_id', '') is not null then
      saved_unit_id := (line->>'content_unit_catalog_id')::uuid;
      select u.physical_quantity, u.physical_unit into definition_quantity, definition_unit
      from public.costing_content_units u where u.id = saved_unit_id;
      if definition_quantity is null then raise exception 'Unidade cadastrada não encontrada na linha %', line_index; end if;
    elsif nullif(btrim(coalesce(line->>'new_content_unit_name', '')), '') is not null then
      if length(btrim(line->>'new_content_unit_name')) > 80 then raise exception 'Nome da unidade muito longo na linha %', line_index; end if;
      definition_quantity := nullif(line->>'new_content_unit_quantity', '')::numeric;
      definition_unit := line->>'new_content_unit_physical_unit';
      if definition_quantity is null or definition_quantity <= 0 or definition_quantity > 999999999
        or definition_unit not in ('g', 'kg', 'ml', 'l', 'unit') then
        raise exception 'Definição da nova unidade inválida na linha %', line_index;
      end if;
      insert into public.costing_content_units(name, physical_quantity, physical_unit, created_by)
      values (btrim(line->>'new_content_unit_name'), definition_quantity, definition_unit, (select auth.uid()))
      on conflict do nothing returning id into saved_unit_id;
      if saved_unit_id is null then
        select u.id, u.physical_quantity, u.physical_unit into saved_unit_id, physical_content_quantity, definition_unit
        from public.costing_content_units u where lower(btrim(u.name)) = lower(btrim(line->>'new_content_unit_name'));
        if physical_content_quantity <> definition_quantity or definition_unit <> line->>'new_content_unit_physical_unit' then
          raise exception 'Esta unidade já existe com outra definição na linha %', line_index;
        end if;
      end if;
    else
      definition_quantity := 1;
      definition_unit := line->>'content_unit';
      if definition_unit not in ('g', 'kg', 'ml', 'l', 'unit') then
        raise exception 'Unidade do conteúdo inválida na linha %', line_index;
      end if;
    end if;
    physical_content_quantity := round(content_count * definition_quantity, 6);
    if physical_content_quantity <= 0 or physical_content_quantity > 9999999999 then
      raise exception 'Conteúdo convertido fora do limite na linha %', line_index;
    end if;
    normalized_line := line || jsonb_build_object(
      'gross_total', round(unit_price * outer_count, 4),
      'content_quantity', physical_content_quantity, 'content_unit', definition_unit,
      'entered_content_quantity', content_count, 'content_unit_catalog_id', saved_unit_id
    );
    normalized_lines := normalized_lines || jsonb_build_array(normalized_line);
  end loop;

  saved_invoice := public.manager_save_costing_purchase_invoice(
    next_supplier_name, next_invoice_number, next_series, next_issued_on,
    next_discount_total, next_freight_total, next_notes, normalized_lines
  );
  line_index := 0;
  for normalized_line in select value from jsonb_array_elements(normalized_lines) value loop
    line_index := line_index + 1;
    update public.costing_purchase_invoice_lines purchase_line set
      outer_unit_price = (normalized_line->>'unit_price')::numeric,
      content_unit_catalog_id = nullif(normalized_line->>'content_unit_catalog_id', '')::uuid,
      entered_content_quantity = (normalized_line->>'entered_content_quantity')::numeric
    where purchase_line.invoice_id = (saved_invoice->>'id')::uuid and purchase_line.line_number = line_index;
  end loop;
  return saved_invoice;
end;
$$;

revoke all on function public.manager_get_costing_purchase_catalog() from public, anon, authenticated;
revoke all on function public.manager_save_costing_purchase_invoice_v2(text, text, text, date, numeric, numeric, text, jsonb) from public, anon, authenticated;
grant execute on function public.manager_get_costing_purchase_catalog() to authenticated;
grant execute on function public.manager_save_costing_purchase_invoice_v2(text, text, text, date, numeric, numeric, text, jsonb) to authenticated;
revoke execute on function public.manager_save_costing_purchase_invoice(text, text, text, date, numeric, numeric, text, jsonb) from authenticated;

comment on table public.costing_package_types is 'Tipos de embalagem usados nas notas de compra, sem controle de estoque.';
comment on table public.costing_content_units is 'Apresentações reutilizáveis com conversão explícita para massa, volume ou unidade.';

commit;
