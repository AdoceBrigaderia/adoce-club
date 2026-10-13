begin;

create table public.costing_purchase_invoices (
  id uuid primary key default gen_random_uuid(),
  supplier_name text not null check (length(btrim(supplier_name)) between 1 and 160),
  invoice_number text not null check (length(btrim(invoice_number)) between 1 and 80),
  series text not null default '' check (length(series) <= 40),
  issued_on date not null,
  subtotal numeric(14,4) not null check (subtotal >= 0),
  discount_total numeric(14,4) not null default 0 check (discount_total >= 0),
  freight_total numeric(14,4) not null default 0 check (freight_total >= 0),
  total_cost numeric(14,4) not null check (total_cost >= 0),
  notes text not null default '' check (length(notes) <= 2000),
  created_by uuid,
  created_at timestamptz not null default now()
);
create unique index costing_purchase_invoice_identity_idx
  on public.costing_purchase_invoices (lower(btrim(supplier_name)), upper(btrim(series)), btrim(invoice_number));

create table public.costing_purchase_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.costing_purchase_invoices(id) on delete restrict,
  line_number integer not null check (line_number > 0),
  item_id uuid not null references public.costing_items(id) on delete restrict,
  price_id uuid not null unique references public.costing_item_prices(id) on delete restrict,
  package_layers jsonb not null check (jsonb_typeof(package_layers) = 'array'),
  content_quantity numeric(16,6) not null check (content_quantity > 0),
  content_unit text not null check (content_unit in ('g', 'kg', 'ml', 'l', 'unit')),
  normalized_quantity numeric(16,6) not null check (normalized_quantity > 0),
  normalized_unit text not null check (normalized_unit in ('g', 'kg', 'ml', 'l', 'unit')),
  useful_quantity numeric(16,6) check (useful_quantity is null or (useful_quantity > 0 and useful_quantity <= normalized_quantity)),
  gross_total numeric(14,4) not null check (gross_total >= 0),
  allocated_discount numeric(14,4) not null check (allocated_discount >= 0),
  allocated_freight numeric(14,4) not null check (allocated_freight >= 0),
  net_total numeric(14,4) not null check (net_total >= 0),
  unique (invoice_id, line_number)
);
create index costing_purchase_invoice_lines_item_idx on public.costing_purchase_invoice_lines(item_id, invoice_id);

create or replace function private.costing_component_item_unit_guard()
returns trigger language plpgsql set search_path = ''
as $$
declare expected_unit text;
begin
  if new.component_kind = 'item' then
    select item.consumption_unit into expected_unit from public.costing_items item where item.id = new.item_id;
    if expected_unit is null or new.unit <> expected_unit then
      raise exception 'A unidade de uso do insumo deve ser a unidade de custo cadastrada: %', expected_unit;
    end if;
  end if;
  return new;
end;
$$;
create trigger costing_component_item_unit_guard
  before insert or update of item_id, component_kind, unit on public.costing_recipe_components
  for each row execute function private.costing_component_item_unit_guard();

alter table public.costing_purchase_invoices enable row level security;
alter table public.costing_purchase_invoice_lines enable row level security;
revoke all on public.costing_purchase_invoices from public, anon, authenticated;
revoke all on public.costing_purchase_invoice_lines from public, anon, authenticated;
grant all on public.costing_purchase_invoices to service_role;
grant all on public.costing_purchase_invoice_lines to service_role;

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
      'id', line.id, 'line_number', line.line_number, 'item_id', line.item_id,
      'item_name', item.name, 'package_layers', line.package_layers,
      'content_quantity', line.content_quantity, 'content_unit', line.content_unit,
      'normalized_quantity', line.normalized_quantity, 'normalized_unit', line.normalized_unit,
      'useful_quantity', line.useful_quantity, 'gross_total', line.gross_total,
      'allocated_discount', line.allocated_discount, 'allocated_freight', line.allocated_freight,
      'net_total', line.net_total
    ) order by line.line_number) from public.costing_purchase_invoice_lines line
      join public.costing_items item on item.id = line.item_id where line.invoice_id = inv.id), '[]'::jsonb)
  ) order by inv.issued_on desc, inv.created_at desc)
  from public.costing_purchase_invoices inv), '[]'::jsonb);
end;
$$;

create or replace function public.manager_save_costing_purchase_invoice(
  next_supplier_name text, next_invoice_number text, next_series text, next_issued_on date,
  next_discount_total numeric, next_freight_total numeric, next_notes text, next_lines jsonb
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  saved_invoice_id uuid;
  saved_item_id uuid;
  saved_price_id uuid;
  line jsonb;
  layer jsonb;
  line_count integer;
  line_index integer := 0;
  subtotal_value numeric := 0;
  gross_value numeric;
  normalized_value numeric;
  content_value numeric;
  content_unit_value text;
  base_unit_value text;
  item_kind_value text;
  item_name_value text;
  code_value text;
  allocated_discount_value numeric;
  allocated_freight_value numeric;
  allocated_discount_sum numeric := 0;
  allocated_freight_sum numeric := 0;
  net_value numeric;
  useful_value numeric;
  checked_value boolean;
  factor_value numeric;
begin
  if not private.is_manager() then raise exception 'Apenas proprietários e gerentes podem cadastrar notas de custo'; end if;
  if length(btrim(coalesce(next_supplier_name, ''))) not between 1 and 160 then raise exception 'Informe o fornecedor'; end if;
  if length(btrim(coalesce(next_invoice_number, ''))) not between 1 and 80 then raise exception 'Informe o número da nota'; end if;
  if length(coalesce(next_series, '')) > 40 then raise exception 'Série muito longa'; end if;
  if next_issued_on is null or next_issued_on > current_date then raise exception 'Data da nota inválida'; end if;
  if jsonb_typeof(next_lines) is distinct from 'array' then raise exception 'Informe os itens da nota'; end if;
  line_count := jsonb_array_length(next_lines);
  if line_count not between 1 and 100 then raise exception 'A nota deve ter de 1 a 100 itens'; end if;
  if coalesce(next_discount_total, -1) < 0 or coalesce(next_freight_total, -1) < 0 then raise exception 'Desconto e frete não podem ser negativos'; end if;
  if length(coalesce(next_notes, '')) > 2000 then raise exception 'Observações muito longas'; end if;

  for line in select value from jsonb_array_elements(next_lines) value loop
    if jsonb_typeof(line) is distinct from 'object' then raise exception 'Linha da nota inválida'; end if;
    gross_value := nullif(line->>'gross_total', '')::numeric;
    if gross_value is null or gross_value < 0 or gross_value > 9999999999 then raise exception 'Valor do item inválido'; end if;
    subtotal_value := subtotal_value + gross_value;
  end loop;
  if subtotal_value <= 0 then raise exception 'Informe ao menos um valor positivo'; end if;
  if next_discount_total > subtotal_value then raise exception 'Desconto maior que o subtotal'; end if;

  insert into public.costing_purchase_invoices (
    supplier_name, invoice_number, series, issued_on, subtotal, discount_total,
    freight_total, total_cost, notes, created_by
  ) values (
    btrim(next_supplier_name), btrim(next_invoice_number), btrim(coalesce(next_series, '')),
    next_issued_on, subtotal_value, next_discount_total, next_freight_total,
    subtotal_value - next_discount_total + next_freight_total,
    btrim(coalesce(next_notes, '')), (select auth.uid())
  ) returning id into saved_invoice_id;

  for line in select value from jsonb_array_elements(next_lines) value loop
    line_index := line_index + 1;
    gross_value := (line->>'gross_total')::numeric;
    if line->>'item_id' is not null and line->>'item_id' <> '' then
      saved_item_id := (line->>'item_id')::uuid;
      select item.consumption_unit, item.item_kind into base_unit_value, item_kind_value
      from public.costing_items item where item.id = saved_item_id and item.active;
      if base_unit_value is null or item_kind_value not in ('ingredient', 'packaging') then raise exception 'Insumo ou embalagem inválido na linha %', line_index; end if;
    else
      saved_item_id := gen_random_uuid();
      item_kind_value := line->>'new_item_kind';
      item_name_value := btrim(coalesce(line->>'new_item_name', ''));
      base_unit_value := line->>'base_unit';
      code_value := upper(btrim(coalesce(line->>'new_item_code', '')));
      if item_kind_value not in ('ingredient', 'packaging') or length(item_name_value) not between 1 and 160 then
        raise exception 'Informe nome e tipo do novo item na linha %', line_index;
      end if;
      if code_value = '' then code_value := 'NF-' || upper(substr(replace(saved_item_id::text, '-', ''), 1, 12)); end if;
      if code_value !~ '^[A-Z0-9][A-Z0-9._-]{0,39}$' then raise exception 'Código interno inválido na linha %', line_index; end if;
      if base_unit_value not in ('g', 'ml', 'unit') then raise exception 'Unidade de custo inválida na linha %', line_index; end if;
      insert into public.costing_items (
        id, internal_code, name, item_kind, supplier, purchase_unit, package_quantity,
        consumption_unit, data_status, active, created_by, updated_by
      ) values (
        saved_item_id, code_value, item_name_value, item_kind_value, btrim(next_supplier_name),
        base_unit_value, 1, base_unit_value, 'provisional', true, (select auth.uid()), (select auth.uid())
      );
      insert into public.costing_item_commercial_settings (
        item_id, cost_origin, commercial_status, created_by, updated_by
      ) values (saved_item_id, 'purchased', 'internal', (select auth.uid()), (select auth.uid()));
    end if;

    content_value := nullif(line->>'content_quantity', '')::numeric;
    content_unit_value := line->>'content_unit';
    if content_value is null or content_value <= 0 or content_value > 999999999 then raise exception 'Conteúdo inválido na linha %', line_index; end if;
    factor_value := case
      when content_unit_value = base_unit_value then 1
      when content_unit_value = 'kg' and base_unit_value = 'g' then 1000
      when content_unit_value = 'g' and base_unit_value = 'kg' then 0.001
      when content_unit_value = 'l' and base_unit_value = 'ml' then 1000
      when content_unit_value = 'ml' and base_unit_value = 'l' then 0.001
      else null end;
    if factor_value is null then raise exception 'Unidades incompatíveis na linha %: % e %', line_index, content_unit_value, base_unit_value; end if;
    if jsonb_typeof(line->'package_layers') is distinct from 'array' or jsonb_array_length(line->'package_layers') not between 1 and 5 then
      raise exception 'Informe de 1 a 5 níveis de embalagem na linha %', line_index;
    end if;
    normalized_value := content_value * factor_value;
    for layer in select value from jsonb_array_elements(line->'package_layers') value loop
      if jsonb_typeof(layer) is distinct from 'object' or length(btrim(coalesce(layer->>'name', ''))) not between 1 and 40 then
        raise exception 'Nome da embalagem inválido na linha %', line_index;
      end if;
      if nullif(layer->>'quantity', '')::numeric is null or (layer->>'quantity')::numeric <= 0 or (layer->>'quantity')::numeric > 1000000
        or mod((layer->>'quantity')::numeric, 1) <> 0 then
        raise exception 'Quantidade de embalagens inválida na linha %', line_index;
      end if;
      normalized_value := normalized_value * (layer->>'quantity')::numeric;
    end loop;
    normalized_value := round(normalized_value, 6);
    if normalized_value <= 0 or normalized_value > 9999999999 then raise exception 'Quantidade total fora do limite na linha %', line_index; end if;
    useful_value := nullif(line->>'useful_quantity', '')::numeric;
    if useful_value is not null and (useful_value <= 0 or useful_value > normalized_value) then
      raise exception 'Quantidade útil inválida na linha %', line_index;
    end if;
    checked_value := coalesce((line->>'checked')::boolean, false);
    if checked_value and useful_value is null then raise exception 'Informe a quantidade útil para conferir a linha %', line_index; end if;

    if line_index = line_count then
      allocated_discount_value := next_discount_total - allocated_discount_sum;
      allocated_freight_value := next_freight_total - allocated_freight_sum;
    else
      allocated_discount_value := round(next_discount_total * gross_value / subtotal_value, 4);
      allocated_freight_value := round(next_freight_total * gross_value / subtotal_value, 4);
      allocated_discount_sum := allocated_discount_sum + allocated_discount_value;
      allocated_freight_sum := allocated_freight_sum + allocated_freight_value;
    end if;
    net_value := gross_value - allocated_discount_value + allocated_freight_value;
    if net_value < 0 then raise exception 'Valor líquido negativo na linha %', line_index; end if;

    insert into public.costing_item_prices (
      item_id, purchase_price, purchased_quantity, purchase_unit, useful_quantity,
      effective_at, data_status, source_note, created_by
    ) values (
      saved_item_id, net_value, normalized_value, base_unit_value, useful_value,
      next_issued_on::timestamptz, case when checked_value then 'validated' else 'provisional' end,
      'Nota ' || btrim(next_invoice_number) || case when btrim(coalesce(next_series, '')) <> '' then '/' || btrim(next_series) else '' end || ' · ' || btrim(next_supplier_name),
      (select auth.uid())
    ) returning id into saved_price_id;
    insert into public.costing_purchase_invoice_lines (
      invoice_id, line_number, item_id, price_id, package_layers, content_quantity,
      content_unit, normalized_quantity, normalized_unit, useful_quantity,
      gross_total, allocated_discount, allocated_freight, net_total
    ) values (
      saved_invoice_id, line_index, saved_item_id, saved_price_id, line->'package_layers',
      content_value, content_unit_value, normalized_value, base_unit_value, useful_value,
      gross_value, allocated_discount_value, allocated_freight_value, net_value
    );
    if checked_value then
      update public.costing_items set data_status = 'validated', updated_by = (select auth.uid()), updated_at = now()
      where id = saved_item_id;
    end if;
  end loop;
  return jsonb_build_object('id', saved_invoice_id, 'total_cost', subtotal_value - next_discount_total + next_freight_total);
end;
$$;

revoke all on function public.manager_get_costing_purchase_workspace() from public, anon, authenticated;
revoke all on function public.manager_save_costing_purchase_invoice(text, text, text, date, numeric, numeric, text, jsonb) from public, anon, authenticated;
grant execute on function public.manager_get_costing_purchase_workspace() to authenticated;
grant execute on function public.manager_save_costing_purchase_invoice(text, text, text, date, numeric, numeric, text, jsonb) to authenticated;
revoke execute on function public.manager_add_costing_item_price(uuid, numeric, numeric, text, numeric, timestamptz, text, text) from authenticated;

comment on table public.costing_purchase_invoices is 'Notas de compra para cálculo de custo; não movimentam estoque.';
comment on table public.costing_purchase_invoice_lines is 'Hierarquia da embalagem, quantidade normalizada e preço histórico da nota; sem saldo de estoque.';

commit;
