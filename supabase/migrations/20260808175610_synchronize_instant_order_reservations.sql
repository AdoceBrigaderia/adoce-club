create or replace function private.recalcular_reserva_de_fatias(alvo_flavor uuid, alvo_data date)
returns void language plpgsql security definer set search_path to '' as $$
begin
  update public.flavor_availability a set quantity_reserved=coalesce((
    select sum(i.quantity)::int from public.instant_order_items i join public.instant_orders o on o.id=i.order_id
    where i.flavor_id=alvo_flavor and (o.created_at at time zone 'America/Fortaleza')::date=alvo_data
      and o.status not in ('cancelled','expired') and i.status <> 'cancelled'
  ),0), updated_at=now() where a.flavor_id=alvo_flavor and a.service_date=alvo_data;
end; $$;
create or replace function private.sincronizar_reserva_de_fatias()
returns trigger language plpgsql security definer set search_path to '' as $$
declare alvo_data date; linha record;
begin
  begin
    linha:=coalesce(new,old);
    if TG_TABLE_NAME='instant_order_items' then
      select (o.created_at at time zone 'America/Fortaleza')::date into alvo_data from public.instant_orders o where o.id=linha.order_id;
      if alvo_data is not null then
        perform private.recalcular_reserva_de_fatias(linha.flavor_id,alvo_data);
        if TG_OP='UPDATE' and old.flavor_id is distinct from new.flavor_id then perform private.recalcular_reserva_de_fatias(old.flavor_id,alvo_data); end if;
      end if;
    else
      alvo_data:=(linha.created_at at time zone 'America/Fortaleza')::date;
      perform private.recalcular_reserva_de_fatias(i.flavor_id,alvo_data) from public.instant_order_items i where i.order_id=linha.id;
    end if;
  exception when others then
    raise warning 'reserva nao sincronizada: %',sqlerrm;
  end;
  return coalesce(new,old);
end; $$;
drop trigger if exists sincroniza_reserva_itens on public.instant_order_items;
create trigger sincroniza_reserva_itens after insert or delete or update on public.instant_order_items for each row execute function private.sincronizar_reserva_de_fatias();
drop trigger if exists sincroniza_reserva_pedidos on public.instant_orders;
create trigger sincroniza_reserva_pedidos after update of status on public.instant_orders for each row execute function private.sincronizar_reserva_de_fatias();
