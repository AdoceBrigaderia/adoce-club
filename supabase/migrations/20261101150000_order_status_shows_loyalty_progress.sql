begin;

-- Pedido do proprietário em 01/11/2026: cadastro e carimbo no Clube agora
-- são automáticos quando a operação confirma o pagamento de um pedido
-- online (ver enrollSaleCustomer chamado em finalizeDirectly). A tela
-- pública de status do pedido (AcompanharPedido.tsx) precisa mostrar esse
-- resultado real pro cliente -- carimbos ganhos nesta compra e progresso
-- atual do cartão -- em vez de nada, como acontecia antes.
create or replace function public.get_instant_order(order_code text, order_token text)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'order_number', target.order_number,
    'status', target.status,
    'payment_status', target.payment_status,
    'total', target.total,
    'payment_url', target.payment_url,
    'payment_expires_at', target.payment_expires_at,
    'reserved_until', target.reserved_until,
    'pickup_label', target.pickup_label,
    'pickup_address', target.pickup_address,
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'name', item.flavor_name, 'quantity', item.quantity,
      'unit_price', item.unit_price, 'status', item.status
    ) order by item.created_at) from public.instant_order_items item
      where item.order_id = target.id), '[]'::jsonb),
    'club_member', target.profile_id is not null,
    'club_new_member', exists(
      select 1 from public.audit_events ae
      where ae.action = 'customer.enrolled_at_sale'
        and ae.entity_id = target.id::text
        and coalesce((ae.payload->>'new_customer')::boolean, false)
    ),
    'club_stamps_added', coalesce((
      select sum(l.stamps_delta)::integer from public.ledger_entries l
      where l.idempotency_key in (
        'instant-order:' || target.id::text || ':purchase',
        'sale-order:' || target.id::text
      )
    ), 0),
    'club_progress', (
      select track.current_progress from public.account_memberships membership
      join public.loyalty_tracks track
        on track.account_id = membership.account_id and track.kind = 'main'
      where membership.profile_id = target.profile_id
        and membership.active and membership.is_primary
      limit 1
    ),
    'club_track_goal', 14
  )
  from public.instant_orders target
  where target.order_number = upper(btrim(order_code))
    and private.instant_order_token_ok(target.id, target.public_token_hash, order_token);
$$;

commit;
