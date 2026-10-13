create or replace function public.manager_update_shopping_week(requested_week date,requested_group text,requested_key text,requested_value jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare saved jsonb; amount numeric; flavor uuid; day_date date; previous numeric; unassigned numeric;
begin
 if not coalesce(private.is_manager(),false) then raise exception 'Acesso restrito à gestão'; end if;
 if requested_week is null or extract(isodow from requested_week)<>1 then raise exception 'Escolha uma semana válida'; end if;
 if requested_group is null or requested_group not in ('cakes','daily','extras','stock','selected','quoteUnits','quoteWeight','quotePrice') or requested_key is null then raise exception 'Campo inválido'; end if;
 if requested_group='daily' then
  if requested_key !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[|][a-fA-F0-9-]{36}$' then raise exception 'Dia inválido'; end if;
  day_date:=split_part(requested_key,'|',1)::date;
  if day_date<requested_week or day_date>requested_week+6 then raise exception 'Dia fora da semana'; end if;
  flavor:=split_part(requested_key,'|',2)::uuid;
 else
  if requested_key !~ '^[a-fA-F0-9-]{36}$' then raise exception 'Campo inválido'; end if;
  flavor:=requested_key::uuid;
 end if;
 if requested_group='selected' then
  if jsonb_typeof(requested_value) is distinct from 'boolean' then raise exception 'Seleção inválida'; end if;
 else
  if jsonb_typeof(requested_value) is distinct from 'number' then raise exception 'Quantidade inválida'; end if;
  amount:=requested_value::text::numeric;
  if amount<0 or amount>1000000000 or (requested_group in ('daily','cakes','quoteUnits') and amount<>trunc(amount)) then raise exception 'Quantidade inválida'; end if;
 end if;
 if requested_group='daily' and amount>1 then raise exception 'Selecione somente uma torta por sabor e dia'; end if;
 if requested_group in ('daily','cakes') then
  if not exists(select 1 from public.flavors where id=flavor) then raise exception 'Sabor inexistente'; end if;
 else
  if not exists(select 1 from public.costing_items where id=flavor) then raise exception 'Item inexistente'; end if;
 end if;
 insert into private.costing_shopping_weeks(week_start) values(requested_week) on conflict do nothing;
 select plan into saved from private.costing_shopping_weeks where week_start=requested_week for update;
 if requested_group='daily' then
  previous:=coalesce((saved->'daily'->>requested_key)::numeric,0);
  unassigned:=greatest(0,coalesce((saved->'cakes'->>flavor::text)::numeric,0)-greatest(0,amount-previous));
  saved:=jsonb_set(saved,array['cakes',flavor::text],to_jsonb(unassigned),true);
 end if;
 saved:=jsonb_set(saved,array[requested_group],coalesce(saved->requested_group,'{}'::jsonb),true);
 saved:=jsonb_set(saved,array[requested_group,requested_key],requested_value,true);
 update private.costing_shopping_weeks set plan=saved,updated_at=clock_timestamp(),updated_by=auth.uid() where week_start=requested_week;
 return saved;
end;$$;

revoke all on function public.manager_update_shopping_week(date,text,text,jsonb) from public,anon;
grant execute on function public.manager_update_shopping_week(date,text,text,jsonb) to authenticated;
