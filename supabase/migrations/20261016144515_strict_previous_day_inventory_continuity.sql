begin;

-- Remove somente os registros criados pela tentativa de recuperação das
-- 11:44 de Fortaleza. Linhas que já existiam hoje ou foram alteradas por um
-- operador ficam intocadas.
delete from private.flavor_batch_continuity
where target_service_date=date '2026-10-16'
  and created_at=timestamptz '2026-10-16 14:44:05.794162+00';

delete from public.flavor_availability_batches
where service_date=date '2026-10-16'
  and created_at=timestamptz '2026-10-16 14:44:05.794162+00';

delete from public.flavor_availability
where service_date=date '2026-10-16'
  and updated_by is null
  and updated_at=timestamptz '2026-10-16 14:44:05.794162+00';

delete from public.audit_events
where action in ('inventory.day_continued','inventory.batch_continued')
  and entity_id='2026-10-16'
  and created_at=timestamptz '2026-10-16 14:44:05.794162+00';

create or replace function private.carry_forward_flavor_inventory(
  target_date date default ((now() at time zone 'America/Fortaleza')::date)
)
returns integer language plpgsql security definer set search_path='' as $$
declare copied_rows integer:=0; fortaleza_today date:=(now() at time zone 'America/Fortaleza')::date;
begin
  if target_date is null or target_date<fortaleza_today-1 or target_date>fortaleza_today+1 then
    raise exception 'Data invalida para continuidade do estoque';
  end if;
  insert into public.flavor_availability(
    flavor_id,service_date,status,note,quantity_available,quantity_reserved,updated_by,updated_at
  )
  select previous.flavor_id,target_date,previous.status,previous.note,
    previous.quantity_available,0,null,now()
  from public.flavor_availability previous
  where previous.service_date=target_date-1
    and previous.quantity_available is not null
    and not exists(select 1 from public.flavor_availability current_inventory
      where current_inventory.flavor_id=previous.flavor_id and current_inventory.service_date=target_date)
  on conflict(flavor_id,service_date) do nothing;
  get diagnostics copied_rows=row_count;
  if copied_rows>0 then
    insert into public.audit_events(actor_user_id,action,entity_type,entity_id,payload)
    values(null,'inventory.day_continued','flavor_inventory',target_date::text,
      jsonb_build_object('service_date',target_date,'copied_rows',copied_rows,
        'rule','strict_previous_day_balance','reserved','zerada'));
  end if;
  return copied_rows;
end; $$;

revoke all on function private.carry_forward_flavor_inventory(date) from public,anon,authenticated;

create or replace function private.carry_forward_flavor_inventory_batches(
  target_date date default ((now() at time zone 'America/Fortaleza')::date)
)
returns integer language plpgsql security definer set search_path='' as $$
declare source record; target_batch uuid; copied integer:=0;
begin
  perform private.carry_forward_flavor_inventory(target_date);
  for source in
    select distinct on (b.flavor_id) b.*,a.quantity_available aggregate_available
    from public.flavor_availability_batches b
    join public.flavor_availability a on a.flavor_id=b.flavor_id and a.service_date=b.service_date
    join public.flavor_availability target on target.flavor_id=b.flavor_id
      and target.service_date=target_date and target.updated_by is null and target.updated_at=now()
    where b.service_date=target_date-1 and b.active and b.quantity_available>0
      and a.quantity_available>0 and a.status not in('sold_out','unavailable')
    order by b.flavor_id,b.available_from desc,b.id
  loop
    select id into target_batch from public.flavor_availability_batches
    where flavor_id=source.flavor_id and service_date=target_date and available_from=time '00:00'
    order by created_at desc limit 1 for update;
    if target_batch is null then continue; end if;
    update public.flavor_availability_batches set available_from=time '08:00',updated_at=now()
    where id=target_batch;
    insert into private.flavor_batch_continuity(source_batch_id,target_batch_id,target_service_date,carried_quantity)
    values(source.id,target_batch,target_date,least(source.quantity_available,source.aggregate_available))
    on conflict(source_batch_id,target_service_date) do nothing;
    copied:=copied+1;
  end loop;
  if copied>0 then
    insert into public.audit_events(actor_user_id,action,entity_type,entity_id,payload)
    values(null,'inventory.batch_continued','flavor_inventory_batch',target_date::text,
      jsonb_build_object('service_date',target_date,'copied_batches',copied,
        'available_from','08:00','rule','strict_previous_day_only'));
  end if;
  return copied;
end; $$;

revoke all on function private.carry_forward_flavor_inventory_batches(date) from public,anon,authenticated;

select private.carry_forward_flavor_inventory_batches(
  (now() at time zone 'America/Fortaleza')::date
);

commit;
