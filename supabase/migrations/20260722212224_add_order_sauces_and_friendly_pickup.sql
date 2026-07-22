-- Caldas editáveis e escolha individual por fatia nos pedidos de retirada.

update public.pickup_locations
set name = 'Adoce Brigaderia',
    public_label = 'Retire na Adoce',
    updated_at = now()
where slug = 'portao-adoce';

create table if not exists public.order_sauces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists order_sauces_name_unique
  on public.order_sauces (lower(btrim(name)));
create index if not exists order_sauces_active_sort_idx
  on public.order_sauces (active, sort_order, name);

insert into public.order_sauces (name, active, sort_order)
values
  ('Calda de chocolate', true, 10),
  ('Calda de Ninho', true, 20)
on conflict (lower(btrim(name))) do nothing;

create table if not exists public.instant_order_item_sauces (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.instant_order_items(id) on delete cascade,
  unit_number integer not null check (unit_number between 1 and 30),
  sauce_id uuid references public.order_sauces(id) on delete set null,
  sauce_name text not null check (char_length(btrim(sauce_name)) between 2 and 80),
  created_at timestamptz not null default now(),
  unique (order_item_id, unit_number)
);

create index if not exists instant_order_item_sauces_item_idx
  on public.instant_order_item_sauces(order_item_id, unit_number);

alter table public.order_sauces enable row level security;
alter table public.instant_order_item_sauces enable row level security;

revoke all on public.order_sauces, public.instant_order_item_sauces
  from public, anon, authenticated;
grant select on public.order_sauces to anon, authenticated;
grant insert, update, delete on public.order_sauces to authenticated;
grant select, insert, update, delete on public.instant_order_item_sauces to authenticated;
grant all on public.order_sauces, public.instant_order_item_sauces to service_role;

create policy order_sauces_public_active_read
  on public.order_sauces for select to anon, authenticated
  using (active);
create policy order_sauces_staff_all
  on public.order_sauces for all to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));
create policy instant_order_item_sauces_staff_all
  on public.instant_order_item_sauces for all to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

create or replace function public.submit_instant_order_v2(
  requested_customer_name text,
  requested_customer_phone text,
  requested_items jsonb,
  requested_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  response jsonb;
  created_order_id uuid;
  requested_item jsonb;
  requested_sauce jsonb;
  target_item_id uuid;
  requested_quantity integer;
  requested_unit integer;
  requested_sauce_id uuid;
  resolved_sauce_name text;
begin
  if (
    select count(*)
    from regexp_split_to_table(btrim(coalesce(requested_customer_name, '')), E'\\s+') part
    where char_length(part) >= 2
  ) < 2 then
    raise exception 'Informe seu nome e sobrenome para identificarmos o pedido';
  end if;

  if requested_items is null or jsonb_typeof(requested_items) <> 'array' then
    raise exception 'Escolha pelo menos uma fatia';
  end if;

  for requested_item in select value from jsonb_array_elements(requested_items)
  loop
    requested_quantity := (requested_item->>'quantity')::integer;
    if requested_item ? 'sauces' then
      if jsonb_typeof(requested_item->'sauces') <> 'array'
         or jsonb_array_length(requested_item->'sauces') <> requested_quantity then
        raise exception 'Escolha uma opção de calda para cada fatia';
      end if;
      if (
        select count(distinct (choice->>'unit_number')::integer)
        from jsonb_array_elements(requested_item->'sauces') choice
      ) <> requested_quantity then
        raise exception 'Revise as escolhas de calda de cada fatia';
      end if;
      for requested_sauce in select value from jsonb_array_elements(requested_item->'sauces')
      loop
        requested_unit := (requested_sauce->>'unit_number')::integer;
        if requested_unit < 1 or requested_unit > requested_quantity then
          raise exception 'Revise a identificação das fatias';
        end if;
        if nullif(requested_sauce->>'sauce_id', '') is not null then
          requested_sauce_id := (requested_sauce->>'sauce_id')::uuid;
          if not exists (
            select 1 from public.order_sauces sauce
            where sauce.id = requested_sauce_id and sauce.active
          ) then
            raise exception 'Uma das caldas escolhidas acabou hoje. Escolha outra opção';
          end if;
        end if;
      end loop;
    end if;
  end loop;

  response := public.submit_instant_order(
    requested_customer_name,
    requested_customer_phone,
    requested_items,
    requested_notes
  );
  if not coalesce((response->>'accepted')::boolean, false) then
    return response;
  end if;

  select target.id into created_order_id
  from public.instant_orders target
  where target.order_number = response->>'order_number';

  for requested_item in select value from jsonb_array_elements(requested_items)
  loop
    if not (requested_item ? 'sauces') then continue; end if;
    select item.id into target_item_id
    from public.instant_order_items item
    where item.order_id = created_order_id
      and item.flavor_id = (requested_item->>'flavor_id')::uuid;

    for requested_sauce in select value from jsonb_array_elements(requested_item->'sauces')
    loop
      requested_unit := (requested_sauce->>'unit_number')::integer;
      requested_sauce_id := nullif(requested_sauce->>'sauce_id', '')::uuid;
      if requested_sauce_id is null then
        resolved_sauce_name := 'Sem calda';
      else
        select sauce.name into resolved_sauce_name
        from public.order_sauces sauce where sauce.id = requested_sauce_id;
      end if;
      insert into public.instant_order_item_sauces (
        order_item_id, unit_number, sauce_id, sauce_name
      ) values (
        target_item_id, requested_unit, requested_sauce_id, resolved_sauce_name
      );
    end loop;
  end loop;
  return response;
end;
$$;

revoke all on function public.submit_instant_order_v2(text,text,jsonb,text)
  from public, anon, authenticated;
grant execute on function public.submit_instant_order_v2(text,text,jsonb,text)
  to anon, authenticated;
