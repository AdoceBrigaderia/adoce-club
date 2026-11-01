begin;

-- Pedido do proprietário em 01/11/2026: o gerente precisa poder excluir um
-- lote de disponibilidade mesmo que já tenha fatias reservadas (o sistema
-- hoje bloqueia com exceção). A exclusão deve ser aceita sempre; a única
-- coisa que o sistema faz é informar quais pedidos têm reserva naquele
-- lote, pra o operador abrir e resolver manualmente.
--
-- "Excluir" continua sendo uma desativação (active=false), nunca um DELETE
-- físico da linha: private.instant_order_batch_allocations referencia
-- batch_id com "on delete restrict" de propósito (preserva a evidência da
-- venda/reserva); apagar a linha do lote quebraria essa integridade. Isso
-- já era true mesmo antes desta migração — só nunca testado porque o
-- caminho com reserva sempre levantava exceção antes de chegar no delete.
drop function if exists public.staff_delete_flavor_availability_batch(uuid);

create function public.staff_delete_flavor_availability_batch(
  target_batch_id uuid,
  force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.flavor_availability_batches%rowtype;
  availability public.flavor_availability%rowtype;
  batch_total integer;
  affected jsonb;
begin
  if (select auth.uid()) is null or not private.is_staff() then
    raise exception 'Acesso não autorizado';
  end if;
  select * into target from public.flavor_availability_batches
  where id = target_batch_id for update;
  if not found then raise exception 'Lote não encontrado'; end if;

  -- Pedidos com reserva ativa deste lote, pra mostrar ao operador antes (ou
  -- depois) da exclusão forçada — nunca pra bloquear.
  select coalesce(jsonb_agg(jsonb_build_object(
    'order_id', o.id, 'order_number', o.order_number,
    'customer_name', o.customer_name, 'sales_channel', o.sales_channel,
    'quantity', a.quantity
  ) order by o.created_at), '[]'::jsonb)
  into affected
  from private.instant_order_batch_allocations a
  join public.instant_order_items i on i.id = a.order_item_id
  join public.instant_orders o on o.id = i.order_id
  where a.batch_id = target.id and a.status = 'reserved';

  -- Sem confirmação explícita (force), só avisa quais pedidos seriam
  -- afetados e não mexe em nada.
  if target.quantity_reserved > 0 and not force then
    return jsonb_build_object('deleted', false, 'affected_orders', affected);
  end if;

  update public.flavor_availability_batches
  set active = false, updated_at = now()
  where id = target.id;

  select * into availability from public.flavor_availability
  where flavor_id = target.flavor_id and service_date = target.service_date for update;
  select coalesce(sum(quantity_available), 0)::integer into batch_total
  from public.flavor_availability_batches
  where flavor_id = target.flavor_id and service_date = target.service_date and active;
  if availability.id is not null then
    update public.flavor_availability
    set quantity_available = batch_total,
        status = case
          when batch_total - quantity_reserved <= 0 then 'sold_out'::public.availability_status
          when batch_total - quantity_reserved <= 3 then 'last_units'::public.availability_status
          else 'available'::public.availability_status
        end,
        updated_by = (select auth.uid()), updated_at = now()
    where id = availability.id;
  end if;

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values (
    (select auth.uid()), 'flavor_availability.batch_deleted',
    'flavor_availability_batch', target.id::text,
    jsonb_build_object(
      'flavor_id', target.flavor_id, 'service_date', target.service_date,
      'forced', force, 'had_reservations', target.quantity_reserved > 0,
      'affected_orders', affected
    )
  );
  return jsonb_build_object('deleted', true, 'affected_orders', affected);
end;
$$;
revoke all on function public.staff_delete_flavor_availability_batch(uuid, boolean)
  from public, anon;
grant execute on function public.staff_delete_flavor_availability_batch(uuid, boolean)
  to authenticated;

commit;
