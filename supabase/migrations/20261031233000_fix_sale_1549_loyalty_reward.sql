-- Acerto da venda FAT-20261031-1549 (autorizado pelo proprietario em
-- 31/10/2026): a cliente tinha 13 carimbos, levou 2 fatias e pagou R$ 16 --
-- a 2a fatia era a fatia gratis do Clube. O Caixa ainda nao oferecia a fatia
-- gratis quando a propria compra completava o cartao, entao a venda entrou
-- como 2 fatias pagas (R$ 32, Pix) e a recompensa ficou "disponivel".
-- Correcao sem apagar historico:
--   * caixa: devolucao (refund, out) de R$ 16 no Pix ligada ao pedido;
--   * pedido: Black Velvet vira a fatia gratis, total R$ 16;
--   * Clube: estorno de 1 carimbo (fica 0 de 14, 1 cartao completo) e a
--     recompensa liberada passa a resgatada neste pedido.

do $$
declare
  v_order public.instant_orders%rowtype;
  v_item uuid;
  v_reward public.rewards%rowtype;
  v_track public.loyalty_tracks%rowtype;
  v_profile uuid;
  v_purchase uuid;
begin
  select * into v_order from public.instant_orders where order_number = 'FAT-20261031-1549' for update;
  if v_order.total <> 32 then
    raise notice 'Venda ja acertada (total %), nada a fazer', v_order.total;
    return;
  end if;

  select id into v_item from public.instant_order_items
  where order_id = v_order.id and flavor_name = 'Black Velvet' and not is_reward and quantity = 1;
  select l.id, l.subject_profile_id into v_purchase, v_profile from public.ledger_entries l
  where l.idempotency_key = 'instant-order:' || v_order.id::text || ':purchase';
  select * into v_track from public.loyalty_tracks t
  where t.id = (select track_id from public.ledger_entries where id = v_purchase) for update;
  select * into v_reward from public.rewards
  where track_id = v_track.id and status = 'available' order by source_cycle limit 1 for update;
  if v_item is null or v_purchase is null or v_reward.id is null or v_track.current_progress <> 1 then
    raise exception 'Estado da venda diferente do esperado; acerto cancelado';
  end if;

  insert into public.cash_movements (cash_session_id, store_id, register_id, kind, direction, payment_method_code, amount, order_id, notes, created_by)
  select m.cash_session_id, m.store_id, m.register_id, 'refund', 'out', 'pix', 16, v_order.id,
         'Acerto: 2a fatia era a fatia grátis do Clube; cliente pagou R$ 16,00.', null
  from public.cash_movements m where m.order_id = v_order.id and m.kind = 'sale' limit 1;

  update public.instant_order_items
  set is_reward = true, unit_price = 0, reward_id = v_reward.id, updated_at = now()
  where id = v_item;

  update public.instant_orders
  set subtotal = 32, discount_amount = 16, total = 16, amount_paid = 16, gross_amount = 16,
      payment_fee_amount = 0.08, net_amount = 15.92,
      payment_allocations = '[{"amount": 16, "method": "pix"}]'::jsonb,
      internal_notes = concat_ws(E'\n', nullif(internal_notes, ''), 'Acerto 31/10: Black Velvet como fatia grátis do Clube; pago R$ 16,00.'),
      updated_at = now()
  where id = v_order.id;

  update public.loyalty_tracks set current_progress = 0, updated_at = now() where id = v_track.id;
  insert into public.ledger_entries (track_id, subject_profile_id, actor_user_id, reason, stamps_delta,
    resulting_progress, resulting_completed_cards, idempotency_key, related_entry_id, metadata)
  values (v_track.id, v_profile, null, 'reversal', -1, 0, v_track.completed_cards,
    'fix-1549:reversal', v_purchase,
    jsonb_build_object('reason', 'Fatia grátis lançada como paga na venda FAT-20261031-1549'));

  update public.rewards set status = 'redeemed', redeemed_at = now(), redemption_idempotency_key = 'fix-1549:reward'
  where id = v_reward.id;
  update public.loyalty_tracks set redeemed_rewards = redeemed_rewards + 1, updated_at = now() where id = v_track.id;
  insert into public.ledger_entries (track_id, subject_profile_id, actor_user_id, reason, stamps_delta,
    resulting_progress, resulting_completed_cards, idempotency_key, metadata)
  values (v_track.id, v_profile, null, 'reward_redeemed', 0, 0, v_track.completed_cards,
    'fix-1549:reward-redeemed', jsonb_build_object('reward_id', v_reward.id, 'order_id', v_order.id));

  insert into public.audit_events (actor_user_id, action, entity_type, entity_id, payload)
  values (null, 'cash.sale_loyalty_corrected', 'instant_order', v_order.id::text,
    jsonb_build_object('order_number', v_order.order_number, 'refund', 16, 'reward_id', v_reward.id));
end $$;
