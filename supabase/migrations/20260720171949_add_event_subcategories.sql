-- Organiza Eventos em duas linhas comerciais sem perder o identificador,
-- preço, agenda ou histórico dos produtos existentes.
alter table public.commercial_products
  add column if not exists subcategory text;

alter table public.commercial_products
  drop constraint if exists commercial_products_event_subcategory_check;

update public.commercial_products
set subcategory = 'trays'
where segment = 'events'
  and slug like 'tabuleiro-%';

update public.commercial_products
set segment = 'events',
    subcategory = 'mini_parties',
    image_url = coalesce(image_url, '/adoce-hoje/festas-eventos.webp'),
    sort_order = 90,
    updated_at = now()
where slug = 'festa-na-mesa';

update public.commercial_products
set subcategory = null
where segment <> 'events';

alter table public.commercial_products
  add constraint commercial_products_event_subcategory_check
  check (
    (segment = 'events' and subcategory in ('trays', 'mini_parties'))
    or (segment <> 'events' and subcategory is null)
  );

create index if not exists commercial_products_event_subcategory_idx
  on public.commercial_products(subcategory, sort_order)
  where segment = 'events' and active and published;
