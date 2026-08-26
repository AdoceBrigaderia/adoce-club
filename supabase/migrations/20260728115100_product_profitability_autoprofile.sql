begin;

create or replace function private.ensure_commercial_product_costing_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  default_yield numeric := 1;
  default_label text := 'unidade';
  raw_yield text := coalesce(new.details->>'yield_slices', '');
begin
  if new.segment::text = 'cakes' then
    default_label := 'fatias';
    if raw_yield ~ '^[0-9]+([.][0-9]+)?$' and raw_yield::numeric > 0 then
      default_yield := raw_yield::numeric;
    else
      default_yield := 13;
    end if;
  end if;

  insert into public.commercial_product_costing_settings(
    product_id,
    cost_origin,
    manual_total_cost,
    yield_quantity,
    yield_label,
    minimum_margin,
    data_status,
    notes
  ) values (
    new.id,
    'manual_provisional',
    0,
    default_yield,
    default_label,
    0,
    'provisional',
    'Custo inicial ainda não informado.'
  )
  on conflict (product_id) do nothing;

  return new;
end;
$$;

drop trigger if exists commercial_products_create_costing_profile on public.commercial_products;
create trigger commercial_products_create_costing_profile
after insert on public.commercial_products
for each row execute function private.ensure_commercial_product_costing_settings();

revoke all on function private.ensure_commercial_product_costing_settings() from public, anon, authenticated;

comment on function private.ensure_commercial_product_costing_settings() is
  'Cria automaticamente um perfil interno de custo e margem para cada novo produto comercial.';

commit;
