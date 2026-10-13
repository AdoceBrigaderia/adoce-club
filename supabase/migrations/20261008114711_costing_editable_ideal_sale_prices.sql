begin;
create table public.costing_sheet_ideal_prices (
  recipe_id uuid not null references public.costing_recipes(id) on delete restrict,
  size_code text not null check (size_code in ('P','M','G','GG')),
  ideal_sale_price numeric(10,2) not null default 18 check (ideal_sale_price>0 and ideal_sale_price<100000000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key(recipe_id,size_code)
);
alter table public.costing_sheet_ideal_prices enable row level security;
revoke all on public.costing_sheet_ideal_prices from public,anon,authenticated;
grant all on public.costing_sheet_ideal_prices to service_role;

insert into public.costing_sheet_ideal_prices(recipe_id,size_code)
select distinct v.recipe_id,v.size_code from public.costing_recipe_versions v
join public.costing_recipes r on r.id=v.recipe_id where r.recipe_kind='final_product' and v.size_code is not null;

create function private.initialize_costing_ideal_sale_price()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.size_code is not null and exists(select 1 from public.costing_recipes where id=new.recipe_id and recipe_kind='final_product') then
    insert into public.costing_sheet_ideal_prices(recipe_id,size_code) values(new.recipe_id,new.size_code)
    on conflict(recipe_id,size_code) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.initialize_costing_ideal_sale_price() from public,anon,authenticated;
create trigger initialize_costing_ideal_sale_price after insert on public.costing_recipe_versions
for each row execute function private.initialize_costing_ideal_sale_price();

create function public.manager_get_costing_ideal_prices()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not private.is_manager() then raise exception 'Apenas proprietários e gerentes podem consultar preços ideais'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('recipe_id',recipe_id,'size_code',size_code,'ideal_sale_price',ideal_sale_price)) from public.costing_sheet_ideal_prices),'[]'::jsonb);
end;
$$;
create function public.manager_set_costing_ideal_price(target_recipe_id uuid,target_size_code text,next_price numeric)
returns numeric language plpgsql security definer set search_path='' as $$
declare previous_price numeric;
begin
  if not private.is_manager() then raise exception 'Apenas proprietários e gerentes podem alterar preços ideais'; end if;
  if next_price is null or next_price::text in ('NaN','Infinity','-Infinity') or next_price<=0 or next_price>=100000000 or next_price<>round(next_price,2) then
    raise exception 'Informe um preço maior que zero, com no máximo duas casas decimais';
  end if;
  if not exists(select 1 from public.costing_recipes r join public.costing_recipe_versions v on v.recipe_id=r.id
    where r.id=target_recipe_id and r.active and r.recipe_kind='final_product' and v.size_code=target_size_code) then raise exception 'Ficha de torta inexistente ou inativa'; end if;
  perform 1 from public.costing_recipes where id=target_recipe_id for update;
  select ideal_sale_price into previous_price from public.costing_sheet_ideal_prices where recipe_id=target_recipe_id and size_code=target_size_code;
  insert into public.costing_sheet_ideal_prices(recipe_id,size_code,ideal_sale_price,updated_by)
  values(target_recipe_id,target_size_code,next_price,(select auth.uid()))
  on conflict(recipe_id,size_code) do update set ideal_sale_price=excluded.ideal_sale_price,updated_at=now(),updated_by=excluded.updated_by;
  if previous_price is distinct from next_price then
    insert into public.audit_events(actor_user_id,action,entity_type,entity_id,payload)
    values((select auth.uid()),'costing.ideal_sale_price_updated','costing_recipe',target_recipe_id::text,
      jsonb_build_object('size_code',target_size_code,'previous_price',previous_price,'next_price',next_price));
  end if;
  return next_price;
end;
$$;
revoke all on function public.manager_get_costing_ideal_prices() from public,anon,authenticated;
revoke all on function public.manager_set_costing_ideal_price(uuid,text,numeric) from public,anon,authenticated;
grant execute on function public.manager_get_costing_ideal_prices() to authenticated;
grant execute on function public.manager_set_costing_ideal_price(uuid,text,numeric) to authenticated;
comment on table public.costing_sheet_ideal_prices is 'Preço ideal interno por ficha de sabor e tamanho. Padrão R$18 por fatia, editável e auditado. Não altera o preço comercial de flavors.';
commit;
