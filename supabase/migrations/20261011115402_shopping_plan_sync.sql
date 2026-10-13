create table private.costing_shopping_plan (
 id boolean primary key default true check(id),
 plan jsonb not null default '{"cakes":{},"extras":{},"stock":{},"selected":{}}'::jsonb,
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id)
);
alter table private.costing_shopping_plan enable row level security;
revoke all on private.costing_shopping_plan from public, anon, authenticated;
insert into private.costing_shopping_plan(id) values(true);
create function public.manager_get_shopping_plan() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
 if not coalesce(private.is_manager(),false) then raise exception 'Acesso restrito à gestão'; end if;
 return (select plan from private.costing_shopping_plan where id=true);
end; $$;
create function public.manager_update_shopping_plan(requested_group text, requested_key text, requested_value jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb; amount numeric;
begin
 if not coalesce(private.is_manager(),false) then raise exception 'Acesso restrito à gestão'; end if;
 if requested_group is null or requested_group not in ('cakes','extras','stock','selected') or requested_key is null or requested_key !~ '^[a-fA-F0-9-]{36}$' then raise exception 'Campo inválido'; end if;
 if requested_group='selected' then
  if jsonb_typeof(requested_value) is distinct from 'boolean' then raise exception 'Seleção inválida'; end if;
 else
  if jsonb_typeof(requested_value) is distinct from 'number' then raise exception 'Quantidade inválida'; end if;
  amount := requested_value::text::numeric;
  if amount<0 or amount>1000000000 or (requested_group='cakes' and amount<>trunc(amount)) then raise exception 'Quantidade inválida'; end if;
 end if;
 if requested_group='cakes' then
  if not exists(select 1 from public.flavors where id=requested_key::uuid) then raise exception 'Sabor inexistente'; end if;
 else
  if not exists(select 1 from public.costing_items where id=requested_key::uuid) then raise exception 'Item inexistente'; end if;
 end if;
 update private.costing_shopping_plan set plan=jsonb_set(plan,array[requested_group,requested_key],requested_value,true),updated_at=now(),updated_by=auth.uid() where id=true returning plan into result;
 return result;
end; $$;
revoke all on function public.manager_get_shopping_plan() from public, anon;
revoke all on function public.manager_update_shopping_plan(text,text,jsonb) from public, anon;
grant execute on function public.manager_get_shopping_plan() to authenticated;
grant execute on function public.manager_update_shopping_plan(text,text,jsonb) to authenticated;
