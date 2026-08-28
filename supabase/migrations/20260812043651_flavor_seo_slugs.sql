-- Endereco publico e estavel para cada sabor.
-- O slug nasce uma vez: editar o nome depois nao muda links ja compartilhados.

alter table public.flavors
  add column if not exists slug text;

create or replace function private.flavor_slug_from_name(flavor_name text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(
    lower(translate(
      flavor_name,
      'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
      'AAAAAEEEEIIIIOOOOOUUUUCAAAAAEEEEIIIIOOOOOUUUUC'
    )),
    '[^a-z0-9]+', '-', 'g'
  ));
$$;

revoke all on function private.flavor_slug_from_name(text)
  from public, anon, authenticated;

update public.flavors
set slug = private.flavor_slug_from_name(name)
where slug is null or btrim(slug) = '';

-- Este e o nome comercial completo usado nos links e compartilhamentos.
update public.flavors
set slug = 'trufado-de-ninho-com-morangos'
where name = 'Trufado de Ninho';

do $$
begin
  if exists (
    select 1
    from public.flavors
    where slug is null or slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ) then
    raise exception 'Ha sabor sem slug publico valido';
  end if;

  if exists (
    select 1 from public.flavors group by slug having count(*) > 1
  ) then
    raise exception 'Ha slugs publicos duplicados em flavors';
  end if;
end;
$$;

alter table public.flavors
  alter column slug set not null;

alter table public.flavors
  add constraint flavors_slug_format
  check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

create unique index if not exists flavors_slug_key
  on public.flavors (slug);

create or replace function private.set_flavor_slug_on_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.slug is null or btrim(new.slug) = '' then
    new.slug := private.flavor_slug_from_name(new.name);
  end if;
  return new;
end;
$$;

revoke all on function private.set_flavor_slug_on_insert()
  from public, anon, authenticated;

drop trigger if exists flavors_set_slug_on_insert on public.flavors;
create trigger flavors_set_slug_on_insert
before insert on public.flavors
for each row execute function private.set_flavor_slug_on_insert();

comment on column public.flavors.slug is
  'Endereco publico estavel do sabor. Nao muda automaticamente quando o nome e editado.';
