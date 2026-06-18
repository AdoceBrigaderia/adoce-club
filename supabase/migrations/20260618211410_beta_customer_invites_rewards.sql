alter table public.beta_customers
  add column if not exists invite_code text,
  add column if not exists referred_by_code text;

create unique index if not exists beta_customers_invite_code_idx
  on public.beta_customers(invite_code)
  where invite_code is not null;

create index if not exists beta_customers_referred_by_code_idx
  on public.beta_customers(referred_by_code)
  where referred_by_code is not null;
