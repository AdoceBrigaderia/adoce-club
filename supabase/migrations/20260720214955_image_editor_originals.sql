alter table public.commercial_products
  add column if not exists original_image_url text;

alter table public.commercial_segment_media
  add column if not exists original_image_url text;

alter table public.flavor_images
  add column if not exists original_image_path text;

alter table public.flavors
  add column if not exists whole_cake_original_image_path text;

comment on column public.commercial_products.original_image_url is
  'Original uploaded product image retained for future non-destructive edits.';

comment on column public.commercial_segment_media.original_image_url is
  'Original uploaded category image retained for future non-destructive edits.';

comment on column public.flavor_images.original_image_path is
  'Original uploaded flavor image retained for future non-destructive edits.';

comment on column public.flavors.whole_cake_original_image_path is
  'Original uploaded whole-cake image retained for future non-destructive edits.';
