begin;

-- O carrinho publico apenas registra a intencao do cliente. Somente itens que
-- a operacao mudou explicitamente para "reserved" entram na reserva agregada.
create or replace function private.recalcular_reserva_de_fatias(
  alvo_flavor uuid,
  alvo_data date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.flavor_availability availability
  set quantity_reserved =
    coalesce((
      select sum(item.quantity)::integer
      from public.instant_order_items item
      join public.instant_orders order_row on order_row.id = item.order_id
      where item.flavor_id = alvo_flavor
        and coalesce(
          item.stock_service_date,
          (order_row.created_at at time zone 'America/Fortaleza')::date
        ) = alvo_data
        and order_row.status not in ('cancelled', 'expired')
        and item.status = 'reserved'
    ), 0)
    + coalesce((
      select sum(draft.quantity)::integer
      from public.cash_draft_reservations draft
      where draft.flavor_id = alvo_flavor
        and draft.service_date = alvo_data
    ), 0),
      updated_at = now()
  where availability.flavor_id = alvo_flavor
    and availability.service_date = alvo_data;
end;
$$;

revoke all on function private.recalcular_reserva_de_fatias(uuid, date)
  from public, anon, authenticated;

-- "Esgotado" deixa de ser um estado automatico. Saldo livre zero significa
-- indisponivel. Quando uma reserva e liberada, o sabor volta automaticamente
-- para ultimas unidades/disponivel, sem desfazer uma indisponibilidade manual.
create or replace function private.normalize_flavor_availability_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  free_quantity integer := greatest(
    coalesce(new.quantity_available, 0) - coalesce(new.quantity_reserved, 0),
    0
  );
  old_free_quantity integer := case
    when tg_op = 'UPDATE' then greatest(
      coalesce(old.quantity_available, 0) - coalesce(old.quantity_reserved, 0),
      0
    )
    else null
  end;
  explicit_manual_unavailable boolean :=
    tg_op = 'UPDATE'
    and new.status = 'unavailable'
    and old.status is distinct from new.status;
begin
  if new.status = 'preorder_only' or explicit_manual_unavailable then
    return new;
  end if;

  if new.status in ('available', 'last_units', 'sold_out')
     or (
       tg_op = 'UPDATE'
       and new.status = 'unavailable'
       and old.status = 'unavailable'
       and old_free_quantity = 0
       and free_quantity > 0
     ) then
    new.status := case
      when free_quantity = 0 then 'unavailable'::public.availability_status
      when free_quantity <= 3 then 'last_units'::public.availability_status
      else 'available'::public.availability_status
    end;
  end if;

  return new;
end;
$$;

revoke all on function private.normalize_flavor_availability_status()
  from public, anon, authenticated;

drop trigger if exists normalize_flavor_availability_status
  on public.flavor_availability;
create trigger normalize_flavor_availability_status
before insert or update of status, quantity_available, quantity_reserved
on public.flavor_availability
for each row execute function private.normalize_flavor_availability_status();

-- Corrige somente o estoque operacional atual/futuro; o historico permanece
-- intacto para auditoria.
update public.flavor_availability
set status = case
      when greatest(coalesce(quantity_available, 0) - coalesce(quantity_reserved, 0), 0) = 0
        then 'unavailable'::public.availability_status
      when greatest(coalesce(quantity_available, 0) - coalesce(quantity_reserved, 0), 0) <= 3
        then 'last_units'::public.availability_status
      else 'available'::public.availability_status
    end,
    updated_at = now()
where status = 'sold_out'
  and service_date >= (now() at time zone 'America/Fortaleza')::date;

-- A virada do dia nunca carrega indisponibilidade, esgotamento ou saldo zero.
create or replace function private.carry_forward_flavor_inventory(
  target_date date default ((now() at time zone 'America/Fortaleza')::date)
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  copied_rows integer := 0;
  fortaleza_today date := (now() at time zone 'America/Fortaleza')::date;
begin
  if target_date is null or target_date < fortaleza_today - 1 or target_date > fortaleza_today + 1 then
    raise exception 'Data invalida para continuidade do estoque';
  end if;

  insert into public.flavor_availability(
    flavor_id, service_date, status, note, quantity_available,
    quantity_reserved, updated_by, updated_at
  )
  select
    previous.flavor_id,
    target_date,
    case
      when previous.quantity_available - previous.quantity_reserved <= 3
        then 'last_units'::public.availability_status
      else 'available'::public.availability_status
    end,
    previous.note,
    previous.quantity_available - previous.quantity_reserved,
    0,
    null,
    now()
  from public.flavor_availability previous
  where previous.service_date = target_date - 1
    and previous.status not in ('sold_out', 'unavailable')
    and greatest(
      coalesce(previous.quantity_available, 0) - coalesce(previous.quantity_reserved, 0),
      0
    ) > 0
    and not exists (
      select 1
      from public.flavor_availability current_inventory
      where current_inventory.flavor_id = previous.flavor_id
        and current_inventory.service_date = target_date
    )
  on conflict (flavor_id, service_date) do nothing;

  get diagnostics copied_rows = row_count;
  -- A virada do dia continua registrada em audit_events: é o histórico que a
  -- operação usa para conferir quantas linhas passaram e sob qual regra.
  if copied_rows > 0 then
    insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
    values (
      null,
      'inventory.day_continued',
      'flavor_inventory',
      target_date::text,
      jsonb_build_object(
        'service_date', target_date,
        'copied_rows', copied_rows,
        'rule', 'strict_positive_free_balance',
        'reserved', 'zerada'
      )
    );
  end if;
  return copied_rows;
end;
$$;

revoke all on function private.carry_forward_flavor_inventory(date)
  from public, anon, authenticated;

commit;
