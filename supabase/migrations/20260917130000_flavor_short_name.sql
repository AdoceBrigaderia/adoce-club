alter table public.flavors add column if not exists short_name text;

update public.flavors
set short_name = left(regexp_replace(btrim(name), '\\s+', ' ', 'g'), 40)
where coalesce(nullif(btrim(short_name), ''), '') = '';

alter table public.flavors
  drop constraint if exists flavors_short_name_length_check;
alter table public.flavors
  add constraint flavors_short_name_length_check
  check (short_name is null or char_length(short_name) between 1 and 40);

comment on column public.flavors.short_name is 'Nome curto editável usado no caixa compacto.';
