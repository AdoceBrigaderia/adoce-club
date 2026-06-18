alter table public.beta_sales
  add column if not exists subtotal_amount numeric not null default 0,
  add column if not exists discount_type text not null default 'none',
  add column if not exists discount_value numeric not null default 0,
  add column if not exists discount_reason text,
  add column if not exists discount_note text,
  add column if not exists discount_amount numeric not null default 0;

update public.beta_sales
set subtotal_amount = gross_amount
where subtotal_amount = 0 and gross_amount > 0;
