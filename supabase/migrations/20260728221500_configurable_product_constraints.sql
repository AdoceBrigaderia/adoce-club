begin;

alter table public.commercial_products
  drop constraint if exists commercial_products_segment_check,
  add constraint commercial_products_segment_check
    check (segment in ('cakes','sweets','events','school','rentals','cookies')),
  drop constraint if exists commercial_products_type_mode_check,
  add constraint commercial_products_type_mode_check check (
    (product_type = 'cake' and customization_mode = 'cake_builder')
    or
    (product_type in ('sweet','cookie','school_kit') and customization_mode in ('none','option_groups'))
    or
    (product_type = 'fixed' and customization_mode = 'none')
  );

comment on constraint commercial_products_type_mode_check on public.commercial_products is
  'Impede que um tipo de produto use um montador incompatível.';

commit;
