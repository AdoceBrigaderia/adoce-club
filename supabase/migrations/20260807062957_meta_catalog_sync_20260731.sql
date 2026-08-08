-- Sincroniza??o segura do cat?logo comercial com a Meta.
-- O portal permanece como fonte de verdade; falhas externas nunca bloqueiam o cadastro local.

alter table public.commercial_products
  add column if not exists meta_retailer_id text,
  add column if not exists meta_product_id text,
  add column if not exists exibir_whatsapp boolean not null default false,
  add column if not exists meta_sync_status text not null default 'disabled',
  add column if not exists meta_last_sync_at timestamptz,
  add column if not exists meta_last_error text,
  add column if not exists meta_last_error_temporary boolean,
  add column if not exists meta_sync_attempts integer not null default 0,
  add column if not exists meta_payload_hash text,
  add column if not exists meta_batch_handle text;

update public.commercial_products
set meta_retailer_id = slug
where meta_retailer_id is null;

alter table public.commercial_products
  alter column meta_retailer_id set not null;

alter table public.commercial_products
  drop constraint if exists commercial_products_meta_retailer_id_format;
alter table public.commercial_products
  add constraint commercial_products_meta_retailer_id_format
  check (meta_retailer_id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

alter table public.commercial_products
  drop constraint if exists commercial_products_meta_sync_status_check;
alter table public.commercial_products
  add constraint commercial_products_meta_sync_status_check
  check (meta_sync_status in ('disabled', 'pending', 'syncing', 'submitted', 'synced', 'error'));

alter table public.commercial_products
  drop constraint if exists commercial_products_meta_sync_attempts_check;
alter table public.commercial_products
  add constraint commercial_products_meta_sync_attempts_check
  check (meta_sync_attempts between 0 and 20);

create unique index if not exists commercial_products_meta_retailer_id_key
  on public.commercial_products(meta_retailer_id);
create index if not exists commercial_products_meta_sync_queue_idx
  on public.commercial_products(meta_sync_status, updated_at)
  where meta_sync_status in ('pending', 'submitted', 'error');

create table if not exists public.meta_catalog_sync_history (
  id bigint generated always as identity primary key,
  product_id uuid references public.commercial_products(id) on delete set null,
  retailer_id text,
  operation text not null check (operation in ('create', 'update', 'availability', 'validate', 'full_sync', 'batch_status')),
  origin text not null check (origin in ('manual', 'automatic', 'reconciliation')),
  status text not null check (status in ('started', 'skipped', 'submitted', 'synced', 'error')),
  http_status integer,
  response_summary text,
  error_message text,
  attempt integer not null default 1 check (attempt between 1 and 20),
  correlation_id uuid not null default gen_random_uuid(),
  payload_hash text,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  batch_handle text,
  created_at timestamptz not null default now()
);

create index if not exists meta_catalog_sync_history_created_idx
  on public.meta_catalog_sync_history(created_at desc);
create index if not exists meta_catalog_sync_history_product_idx
  on public.meta_catalog_sync_history(product_id, created_at desc)
  where product_id is not null;
create index if not exists meta_catalog_sync_history_status_idx
  on public.meta_catalog_sync_history(status, created_at desc);

create or replace function private.prepare_meta_catalog_sync()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  source_changed boolean := false;
begin
  if tg_op = 'INSERT' then
    new.meta_retailer_id := coalesce(nullif(btrim(new.meta_retailer_id), ''), new.slug);
    new.meta_sync_status := case when new.exibir_whatsapp then 'pending' else 'disabled' end;
    return new;
  end if;

  if new.meta_retailer_id is distinct from old.meta_retailer_id then
    raise exception 'O identificador permanente da Meta n?o pode ser alterado';
  end if;

  source_changed :=
    new.name is distinct from old.name or
    new.short_description is distinct from old.short_description or
    new.description is distinct from old.description or
    new.base_price is distinct from old.base_price or
    new.image_url is distinct from old.image_url or
    new.segment is distinct from old.segment or
    new.published is distinct from old.published or
    new.active is distinct from old.active or
    new.exibir_whatsapp is distinct from old.exibir_whatsapp;

  if source_changed then
    if new.exibir_whatsapp or old.meta_payload_hash is not null or old.meta_product_id is not null then
      new.meta_sync_status := 'pending';
    else
      new.meta_sync_status := 'disabled';
    end if;
    new.meta_last_error := null;
    new.meta_last_error_temporary := null;
  end if;
  return new;
end;
$$;

drop trigger if exists commercial_products_prepare_meta_sync on public.commercial_products;
create trigger commercial_products_prepare_meta_sync
before insert or update on public.commercial_products
for each row execute function private.prepare_meta_catalog_sync();

alter table public.meta_catalog_sync_history enable row level security;

drop policy if exists meta_catalog_sync_history_manager_select on public.meta_catalog_sync_history;
create policy meta_catalog_sync_history_manager_select
  on public.meta_catalog_sync_history for select to authenticated
  using (private.is_manager());

grant select on public.meta_catalog_sync_history to authenticated;
grant all on public.meta_catalog_sync_history to service_role;
grant usage, select on sequence public.meta_catalog_sync_history_id_seq to service_role;

comment on column public.commercial_products.meta_retailer_id is
  'Identificador permanente usado como product_retailer_id na Meta; n?o muda com nome ou descri??o.';
comment on table public.meta_catalog_sync_history is
  'Trilha administrativa da integra??o com a Meta. Sem acesso p?blico e sem credenciais.';
