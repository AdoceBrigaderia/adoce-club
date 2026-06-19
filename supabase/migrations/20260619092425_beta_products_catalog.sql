create table if not exists public.beta_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null unique,
  short_name text not null,
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.beta_products enable row level security;

create index if not exists beta_products_active_name_idx
  on public.beta_products (active, name);

create or replace function public.set_beta_products_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_beta_products_updated_at on public.beta_products;
create trigger set_beta_products_updated_at
before update on public.beta_products
for each row execute function public.set_beta_products_updated_at();
