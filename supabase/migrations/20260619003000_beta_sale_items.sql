alter table public.beta_sales
  add column if not exists items jsonb not null default '[]'::jsonb;

update public.beta_sales
set items = jsonb_build_array(jsonb_build_object(
  'flavor', coalesce(flavor, 'Fatia'),
  'quantity', qty,
  'syrup', syrup
))
where items = '[]'::jsonb;
