-- Impede sabores fora da disponibilidade, mantém estoque coerente e torna o
-- cancelamento do Pede Junto uma ação real e auditável.

alter table public.pede_junto_groups
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancellation_reason text;

create or replace function public.set_pede_junto_selection(
  group_code text,
  participant_token text,
  selected_flavor_id uuid,
  selected_quantity integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_group public.pede_junto_groups%rowtype;
  target_participant public.pede_junto_participants%rowtype;
  target_flavor public.flavors%rowtype;
  target_availability public.flavor_availability%rowtype;
  current_total integer;
begin
  if selected_quantity not between 0 and 30 then
    raise exception 'Escolha uma quantidade entre 0 e 30';
  end if;
  select * into target_group from public.pede_junto_groups g
  where g.public_code = upper(trim(group_code)) for update;
  if not found or target_group.status <> 'open' or target_group.closes_at <= now() then
    raise exception 'Este grupo não aceita mais alterações';
  end if;
  select * into target_participant from public.pede_junto_participants p
  where p.group_id = target_group.id
    and p.participant_token_hash = private.pede_junto_hash(participant_token)
    and p.status = 'active';
  if not found then raise exception 'Participante não identificado'; end if;

  select * into target_flavor from public.flavors f
  where f.id = selected_flavor_id and f.active;
  if not found then raise exception 'Sabor indisponível'; end if;

  if selected_quantity > 0 then
    select * into target_availability
    from public.flavor_availability availability
    where availability.flavor_id = target_flavor.id
      and availability.service_date = (now() at time zone 'America/Fortaleza')::date
      and availability.status in ('available', 'last_units', 'preorder_only');
    if not found then
      raise exception 'Este sabor não está liberado para pedidos hoje';
    end if;
    if target_availability.quantity_available is not null
       and target_availability.quantity_available - target_availability.quantity_reserved < selected_quantity then
      raise exception 'A quantidade disponível deste sabor mudou. Atualize a página e escolha novamente';
    end if;
  end if;

  if selected_quantity = 0 then
    delete from public.pede_junto_items
    where participant_id = target_participant.id and flavor_id = target_flavor.id;
  else
    select coalesce(sum(i.quantity), 0) into current_total
    from public.pede_junto_items i
    where i.participant_id = target_participant.id and i.flavor_id <> target_flavor.id
      and i.status <> 'cancelled';
    if current_total + selected_quantity > 50 then
      raise exception 'Cada pessoa pode adicionar até 50 fatias';
    end if;
    insert into public.pede_junto_items(
      group_id, participant_id, flavor_id, flavor_name, unit_price, quantity, status
    ) values (
      target_group.id, target_participant.id, target_flavor.id,
      target_flavor.name, target_flavor.base_price, selected_quantity, 'selected'
    )
    on conflict (participant_id, flavor_id) do update
      set quantity = excluded.quantity,
          flavor_name = excluded.flavor_name,
          unit_price = excluded.unit_price,
          status = 'selected',
          updated_at = now();
  end if;

  update public.pede_junto_groups
  set free_delivery_unlocked_at = case
        when free_delivery_unlocked_at is null and (
          select coalesce(sum(i.quantity), 0)
          from public.pede_junto_items i
          join public.pede_junto_participants p on p.id = i.participant_id
          where i.group_id = target_group.id and p.status = 'active'
            and i.status = 'selected'
        ) >= minimum_slices then now()
        else free_delivery_unlocked_at
      end,
      updated_at = now()
  where id = target_group.id;

  return private.pede_junto_room_payload(target_group.id, participant_token);
end;
$$;

revoke all on function public.set_pede_junto_selection(text,text,uuid,integer)
  from public, anon, authenticated;
grant execute on function public.set_pede_junto_selection(text,text,uuid,integer)
  to anon, authenticated;

create or replace function public.staff_update_pede_junto_participant(
  target_participant_id uuid,
  next_status text,
  next_payment_url text default null,
  next_payment_expires_at timestamptz default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target public.pede_junto_participants%rowtype;
  target_group public.pede_junto_groups%rowtype;
begin
  if (select auth.uid()) is null or not (select private.is_staff()) then
    raise exception 'Acesso restrito à equipe Adoce';
  end if;
  if next_status not in ('active', 'payment_pending', 'paid', 'removed', 'cancelled') then
    raise exception 'Situação inválida';
  end if;
  select * into target from public.pede_junto_participants where id = target_participant_id for update;
  if not found then raise exception 'Participante não encontrado'; end if;
  select * into target_group from public.pede_junto_groups where id = target.group_id;

  if next_status = 'paid' and target.status <> 'paid' then
    update public.flavor_availability availability
    set quantity_available = greatest(0, availability.quantity_available - requested.quantity),
        quantity_reserved = greatest(0, availability.quantity_reserved - requested.quantity),
        updated_at = now()
    from (
      select item.flavor_id, sum(item.quantity)::integer quantity
      from public.pede_junto_items item
      where item.participant_id = target.id and item.status = 'reserved'
      group by item.flavor_id
    ) requested
    where availability.flavor_id = requested.flavor_id
      and availability.service_date = (coalesce(target_group.submitted_at, target_group.created_at) at time zone 'America/Fortaleza')::date
      and availability.quantity_available is not null;
    update public.pede_junto_items set status = 'paid', updated_at = now()
    where participant_id = target.id and status = 'reserved';
  elsif next_status in ('removed', 'cancelled') and target.status <> 'paid' then
    update public.flavor_availability availability
    set quantity_reserved = greatest(0, availability.quantity_reserved - requested.quantity),
        updated_at = now()
    from (
      select item.flavor_id, sum(item.quantity)::integer quantity
      from public.pede_junto_items item
      where item.participant_id = target.id and item.status = 'reserved'
      group by item.flavor_id
    ) requested
    where availability.flavor_id = requested.flavor_id
      and availability.service_date = (coalesce(target_group.submitted_at, target_group.created_at) at time zone 'America/Fortaleza')::date;
    update public.pede_junto_items set status = 'cancelled', updated_at = now()
    where participant_id = target.id and status in ('selected', 'reserved', 'unavailable');
  end if;

  update public.pede_junto_participants
  set status = next_status,
      payment_url = nullif(trim(next_payment_url), ''),
      payment_expires_at = next_payment_expires_at,
      paid_at = case when next_status = 'paid' then coalesce(paid_at, now()) else paid_at end,
      updated_at = now()
  where id = target.id;
end;
$$;

drop function if exists public.staff_update_pede_junto_group(uuid,text);
create function public.staff_update_pede_junto_group(
  target_group_id uuid,
  next_status text,
  next_cancellation_reason text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target public.pede_junto_groups%rowtype;
begin
  if (select auth.uid()) is null or not (select private.is_staff()) then
    raise exception 'Acesso restrito à equipe Adoce';
  end if;
  if next_status not in (
    'open', 'submitted', 'confirmed', 'awaiting_payment', 'preparing',
    'ready', 'completed', 'cancelled', 'expired'
  ) then raise exception 'Situação inválida'; end if;
  select * into target from public.pede_junto_groups where id = target_group_id for update;
  if not found then raise exception 'Grupo não encontrado'; end if;

  if next_status in ('preparing', 'ready', 'completed') and exists (
    select 1 from public.pede_junto_participants participant
    where participant.group_id = target.id
      and participant.status not in ('paid', 'removed', 'cancelled')
  ) then
    raise exception 'Ainda há participante com pagamento pendente';
  end if;
  if next_status = 'completed' and exists (
    select 1 from public.pede_junto_items item
    where item.group_id = target.id and item.status not in ('paid', 'cancelled')
  ) then
    raise exception 'O grupo ainda possui fatias sem pagamento confirmado';
  end if;

  if next_status = 'cancelled' then
    if char_length(btrim(coalesce(next_cancellation_reason, ''))) < 5 then
      raise exception 'Informe o motivo do cancelamento';
    end if;
    if exists (select 1 from public.pede_junto_participants where group_id = target.id and status = 'paid') then
      raise exception 'Há pagamento confirmado. Registre o estorno antes de cancelar o grupo';
    end if;
    update public.flavor_availability availability
    set quantity_reserved = greatest(0, availability.quantity_reserved - requested.quantity),
        updated_at = now()
    from (
      select item.flavor_id, sum(item.quantity)::integer quantity
      from public.pede_junto_items item
      where item.group_id = target.id and item.status = 'reserved'
      group by item.flavor_id
    ) requested
    where availability.flavor_id = requested.flavor_id
      and availability.service_date = (coalesce(target.submitted_at, target.created_at) at time zone 'America/Fortaleza')::date;
    update public.pede_junto_items set status = 'cancelled', updated_at = now()
    where group_id = target.id and status in ('selected', 'reserved', 'unavailable');
    update public.pede_junto_participants set status = 'cancelled', updated_at = now()
    where group_id = target.id and status in ('active', 'payment_pending');
  end if;

  update public.pede_junto_groups
  set status = next_status,
      confirmed_at = case when next_status = 'confirmed' then coalesce(confirmed_at, now()) else confirmed_at end,
      cancelled_at = case when next_status = 'cancelled' then now() else cancelled_at end,
      cancellation_reason = case when next_status = 'cancelled' then btrim(next_cancellation_reason) else cancellation_reason end,
      updated_at = now()
  where id = target.id;

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values ((select auth.uid()), 'pede_junto.status_changed', 'pede_junto_group', target.id::text,
    jsonb_build_object('from_status', target.status, 'status', next_status, 'public_code', target.public_code,
      'reason', nullif(btrim(coalesce(next_cancellation_reason, '')), '')));
end;
$$;

revoke all on function public.staff_update_pede_junto_group(uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.staff_update_pede_junto_group(uuid,text,text)
  to authenticated;

-- O proprietário solicitou o cancelamento deste grupo após repetidas tentativas
-- na interface. Libera somente reservas ainda não pagas e preserva o histórico.
do $$
declare
  target public.pede_junto_groups%rowtype;
begin
  select * into target from public.pede_junto_groups
  where public_code = '3053479598' for update;
  if not found or target.status = 'cancelled' then return; end if;
  if exists (select 1 from public.pede_junto_participants where group_id = target.id and status = 'paid') then
    return;
  end if;
  update public.flavor_availability availability
  set quantity_reserved = greatest(0, availability.quantity_reserved - requested.quantity), updated_at = now()
  from (
    select item.flavor_id, sum(item.quantity)::integer quantity
    from public.pede_junto_items item
    where item.group_id = target.id and item.status = 'reserved'
    group by item.flavor_id
  ) requested
  where availability.flavor_id = requested.flavor_id
    and availability.service_date = (coalesce(target.submitted_at, target.created_at) at time zone 'America/Fortaleza')::date;
  update public.pede_junto_items set status = 'cancelled', updated_at = now()
  where group_id = target.id and status in ('selected', 'reserved', 'unavailable');
  update public.pede_junto_participants set status = 'cancelled', updated_at = now()
  where group_id = target.id and status in ('active', 'payment_pending');
  update public.pede_junto_groups
  set status = 'cancelled', cancelled_at = now(),
      cancellation_reason = 'Cancelamento solicitado pelo proprietário após falha da interface', updated_at = now()
  where id = target.id;
  insert into public.audit_events(action, entity_type, entity_id, payload)
  values ('pede_junto.cancelled_by_migration', 'pede_junto_group', target.id::text,
    jsonb_build_object('from_status', target.status, 'status', 'cancelled', 'public_code', target.public_code));
end;
$$;
