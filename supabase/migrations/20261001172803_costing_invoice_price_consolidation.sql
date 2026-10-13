begin;

create or replace function private.costing_consolidate_invoice_item_prices()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare combined record;
begin
  for combined in
    select line.item_id, line.normalized_unit, sum(line.net_total) as net_total,
      sum(line.normalized_quantity) as purchased_quantity,
      case when bool_and(price.data_status = 'validated') then sum(line.useful_quantity) else null end as useful_quantity,
      bool_and(price.data_status = 'validated') as checked
    from public.costing_purchase_invoice_lines line
    join public.costing_item_prices price on price.id = line.price_id
    where line.invoice_id = new.id
    group by line.item_id, line.normalized_unit
    having count(*) > 1
  loop
    insert into public.costing_item_prices (
      item_id, purchase_price, purchased_quantity, purchase_unit, useful_quantity,
      effective_at, data_status, source_note, created_by, created_at
    ) values (
      combined.item_id, combined.net_total, combined.purchased_quantity,
      combined.normalized_unit, combined.useful_quantity, new.issued_on::timestamptz,
      case when combined.checked then 'validated' else 'provisional' end,
      'Nota ' || new.invoice_number || case when new.series <> '' then '/' || new.series else '' end ||
      ' · ' || new.supplier_name || ' · conjunto de apresentações',
      new.created_by, clock_timestamp()
    );
  end loop;
  return new;
end;
$$;

create constraint trigger costing_consolidate_invoice_item_prices
  after insert on public.costing_purchase_invoices
  deferrable initially deferred
  for each row execute function private.costing_consolidate_invoice_item_prices();

commit;
