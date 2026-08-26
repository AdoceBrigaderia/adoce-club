-- Recheios, massas, sabores e personalizações configuráveis por produto.

create table if not exists public.commercial_product_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.commercial_products(id) on delete cascade,
  group_key text not null default 'opcoes' check (group_key ~ '^[a-z0-9_]+$'),
  label text not null check (char_length(label) between 1 and 120),
  price_adjustment numeric(10,2) not null default 0 check (price_adjustment >= 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, group_key, label)
);

create index if not exists commercial_product_options_product_idx
  on public.commercial_product_options(product_id, group_key, sort_order) where active;

drop trigger if exists commercial_product_options_touch on public.commercial_product_options;
create trigger commercial_product_options_touch before update on public.commercial_product_options
for each row execute function private.touch_commercial_updated_at();

alter table public.commercial_product_options enable row level security;

drop policy if exists commercial_product_options_public_read on public.commercial_product_options;
create policy commercial_product_options_public_read on public.commercial_product_options
for select to anon, authenticated
using (
  active and exists (
    select 1 from public.commercial_products product
    where product.id = product_id and product.active and product.published
  )
);

drop policy if exists commercial_product_options_manager_all on public.commercial_product_options;
create policy commercial_product_options_manager_all on public.commercial_product_options
for all to authenticated
using (private.is_manager())
with check (private.is_manager());

grant select on public.commercial_product_options to anon, authenticated;
grant insert, update, delete on public.commercial_product_options to authenticated;

insert into public.commercial_product_options (
  product_id, group_key, label, price_adjustment, active, sort_order
)
select product.id, option.group_key, option.label, option.price_adjustment, true, option.sort_order
from public.commercial_products product
cross join (values
  ('massa', 'Massa branca', 0::numeric, 10),
  ('massa', 'Massa de chocolate', 0::numeric, 20),
  ('recheio', 'Brigadeiro', 0::numeric, 30),
  ('recheio', 'Ninho', 0::numeric, 40),
  ('recheio', 'Doce de leite', 0::numeric, 50)
) as option(group_key, label, price_adjustment, sort_order)
where product.segment = 'cakes'
on conflict (product_id, group_key, label) do nothing;
