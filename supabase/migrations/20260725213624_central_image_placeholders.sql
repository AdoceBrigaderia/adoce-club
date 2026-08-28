begin;

alter table public.flavors
  alter column image_path set default '/site/placeholder-sabor-sem-foto.svg';

alter table public.commercial_products
  alter column image_url set default '/site/placeholder-produto-sem-foto.svg';

create or replace function private.apply_flavor_image_placeholders()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.image_path is null or btrim(new.image_path) = '' then
    new.image_path := '/site/placeholder-sabor-sem-foto.svg';
  end if;

  if new.whole_cake_available
     and (new.whole_cake_image_path is null or btrim(new.whole_cake_image_path) = '') then
    new.whole_cake_image_path := '/site/placeholder-torta-sem-foto.svg';
  end if;

  return new;
end;
$$;

create or replace function private.apply_commercial_product_image_placeholder()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.image_url is null or btrim(new.image_url) = '' then
    new.image_url := case
      when new.segment = 'cakes' then '/site/placeholder-torta-sem-foto.svg'
      else '/site/placeholder-produto-sem-foto.svg'
    end;
  end if;

  return new;
end;
$$;

drop trigger if exists flavors_apply_image_placeholders on public.flavors;
create trigger flavors_apply_image_placeholders
before insert or update of image_path, whole_cake_image_path, whole_cake_available
on public.flavors
for each row execute function private.apply_flavor_image_placeholders();

drop trigger if exists commercial_products_apply_image_placeholder on public.commercial_products;
create trigger commercial_products_apply_image_placeholder
before insert or update of image_url, segment
on public.commercial_products
for each row execute function private.apply_commercial_product_image_placeholder();

update public.flavors
set image_path = '/site/placeholder-sabor-sem-foto.svg'
where image_path is null or btrim(image_path) = '';

update public.flavors
set whole_cake_image_path = '/site/placeholder-torta-sem-foto.svg'
where whole_cake_available
  and (whole_cake_image_path is null or btrim(whole_cake_image_path) = '');

update public.commercial_products
set image_url = case
  when segment = 'cakes' then '/site/placeholder-torta-sem-foto.svg'
  else '/site/placeholder-produto-sem-foto.svg'
end
where image_url is null or btrim(image_url) = '';

commit;
