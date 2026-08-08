create or replace function private.carry_forward_flavor_inventory(target_date date default ((now() at time zone 'America/Fortaleza')::date))
returns integer language plpgsql security definer set search_path to '' as $$
declare copied_rows integer:=0; fortaleza_today date:=(now() at time zone 'America/Fortaleza')::date;
begin
  if target_date is null or target_date < fortaleza_today-1 or target_date > fortaleza_today+1 then raise exception 'Data invalida para continuidade do estoque'; end if;
  insert into public.flavor_availability(flavor_id,service_date,status,note,quantity_available,quantity_reserved,updated_by,updated_at)
  select distinct on(previous.flavor_id) previous.flavor_id,target_date,previous.status,previous.note,previous.quantity_available,0,null,now()
  from public.flavor_availability previous where previous.service_date<target_date and previous.quantity_available is not null
    and not exists(select 1 from public.flavor_availability atual where atual.flavor_id=previous.flavor_id and atual.service_date=target_date)
  order by previous.flavor_id,previous.service_date desc,previous.updated_at desc on conflict(flavor_id,service_date) do nothing;
  get diagnostics copied_rows=row_count;
  if copied_rows > 0 then
    insert into public.audit_events(actor_user_id,action,entity_type,entity_id,payload)
    values(null,'inventory.day_continued','flavor_inventory',target_date::text,
      jsonb_build_object('service_date',target_date,'copied_rows',copied_rows,
        'rule','same_controlled_balance_without_reset','reserved','zerada'));
  end if;
  return copied_rows;
end; $$;
