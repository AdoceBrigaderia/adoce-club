-- Fatia gratis na mesma compra que completa o cartao (pedido do proprietario
-- em 31/10/2026). Ex.: cliente com 13 carimbos compra 2 fatias -> a 1a fatia
-- paga completa o cartao e a 2a sai como fatia gratis, com desconto no total.
-- Antes o Caixa so oferecia a fatia gratis quando ela ja estava liberada; agora
-- o tipo 'projected' lanca primeiro os carimbos das fatias pagas (o que libera a
-- recompensa) e em seguida resgata essa recompensa na propria venda.

-- Carimbos uma vez so: a venda do caixa com cliente identificado ja lanca os
-- carimbos sozinha ao confirmar o pagamento (staff_create_manual_sale ->
-- staff_confirm_instant_order_payment, chave instant-order:<pedido>:purchase),
-- contando TODAS as fatias, inclusive a que vira fatia gratis. Antes, o caminho
-- 'digital' ainda lancava as fatias pagas de novo (1 caso em 30/10/2026). Agora
-- esta funcao confere o que ja foi lancado e so acerta a diferenca: lanca o que
-- falta ou estorna o carimbo da fatia gratis.

create or replace function private.cash_sale_stamp_reversal(target_track uuid, target_profile uuid, quantity integer, operation_key text, related_entry uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  track_row public.loyalty_tracks%rowtype;
  total_after integer;
  new_completed integer;
  new_progress smallint;
begin
  if quantity < 1 then return; end if;
  if exists (select 1 from public.ledger_entries where idempotency_key = operation_key) then return; end if;
  select * into track_row from public.loyalty_tracks where id = target_track for update;
  total_after := greatest(0, track_row.completed_cards * 14 + track_row.current_progress - quantity);
  new_completed := total_after / 14;
  new_progress := (total_after % 14)::smallint;
  if new_completed < track_row.completed_cards then
    if exists (select 1 from public.rewards w where w.track_id = target_track and w.source_cycle > new_completed and w.status = 'redeemed') then
      raise exception 'Ajuste de carimbos alcanca fatia gratis ja resgatada';
    end if;
    update public.rewards set status = 'reversed', reversed_at = now()
    where track_id = target_track and source_cycle > new_completed and status = 'available';
  end if;
  update public.loyalty_tracks set current_progress = new_progress, completed_cards = new_completed, updated_at = now() where id = target_track;
  insert into public.ledger_entries (track_id, subject_profile_id, actor_user_id, reason, stamps_delta,
    resulting_progress, resulting_completed_cards, idempotency_key, related_entry_id, metadata)
  values (target_track, target_profile, (select auth.uid()), 'reversal', -quantity, new_progress, new_completed,
    operation_key, related_entry, jsonb_build_object('reason', 'Fatia gratis do Clube nao gera carimbo'));
end;
$$;
revoke all on function private.cash_sale_stamp_reversal(uuid, uuid, integer, text, uuid) from public;

create or replace function public.staff_finalize_cash_sale_with_customer(target_session_id uuid, target_draft_key text, requested_operation_key uuid, requested_customer_name text, requested_customer_phone text, requested_customer_profile_id uuid, requested_customer_reward_id uuid, requested_items jsonb, requested_reward_unit text, requested_reward_kind text, requested_payment_method text, requested_discount jsonb DEFAULT '{"kind": "none", "value": 0}'::jsonb, requested_payments jsonb DEFAULT '[]'::jsonb, requested_change jsonb DEFAULT '{}'::jsonb, requested_notes text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  previous jsonb;
  response jsonb;
  v_order_id uuid;
  target_flavor_id uuid;
  target_unit_number integer;
  source_item public.instant_order_items%rowtype;
  reward_item_id uuid;
  reward_sauce public.instant_order_item_sauces%rowtype;
  flavor_price numeric(10,2);
  subtotal numeric(10,2);
  user_discount numeric(10,2);
  reward_credit numeric(10,2);
  combined_discount jsonb;
  total_quantity integer;
  paid_quantity integer;
  account_id uuid;
  reward_track uuid;
  track_progress integer;
  projected_reward_id uuid;
  auto_entry_id uuid;
  auto_stamps integer := 0;
  stamp_diff integer;
begin
  if actor is null or not private.is_staff() then raise exception 'Acesso não autorizado'; end if;
  if requested_operation_key is null then raise exception 'Chave de operação inválida'; end if;
  if requested_reward_kind not in ('manual','digital','projected') then raise exception 'Tipo de fidelidade inválido'; end if;
  perform pg_advisory_xact_lock(hashtextextended('cash-customer-loyalty:' || requested_operation_key::text, 0));
  select response_payload into previous from private.cash_customer_loyalty_requests where operation_key=requested_operation_key and actor_id=actor;
  if previous is not null then return previous || jsonb_build_object('idempotent', true); end if;

  target_flavor_id := nullif(split_part(coalesce(requested_reward_unit,''), ':', 1), '')::uuid;
  target_unit_number := nullif(split_part(coalesce(requested_reward_unit,''), ':', 2), '')::integer;
  if target_flavor_id is null or target_unit_number is null or target_unit_number < 1 then raise exception 'Escolha a fatia da fidelidade'; end if;
  if not exists(select 1 from jsonb_array_elements(requested_items) item where (item->>'flavor_id')::uuid=target_flavor_id and target_unit_number <= (item->>'quantity')::integer) then
    raise exception 'A fatia escolhida não está no carrinho';
  end if;

  select base_price into flavor_price from public.flavors where id=target_flavor_id and active for share;
  if flavor_price is null then raise exception 'Sabor da fidelidade indisponível'; end if;
  select coalesce(sum(f.base_price * (item->>'quantity')::integer),0), coalesce(sum((item->>'quantity')::integer),0)
  into subtotal,total_quantity from jsonb_array_elements(requested_items) item join public.flavors f on f.id=(item->>'flavor_id')::uuid;
  user_discount := case coalesce(requested_discount->>'kind','none')
    when 'percent' then least(subtotal, round(subtotal * least(greatest(coalesce((requested_discount->>'value')::numeric,0),0),100) / 100,2))
    when 'amount' then least(subtotal, round(greatest(coalesce((requested_discount->>'value')::numeric,0),0),2))
    else 0 end;
  reward_credit := least(flavor_price,16);
  combined_discount := jsonb_build_object('kind','amount','value',least(subtotal,user_discount+reward_credit));

  if requested_reward_kind = 'digital' then
    if requested_customer_profile_id is null or requested_customer_reward_id is null then raise exception 'Identifique o cliente e a recompensa'; end if;
    select membership.account_id,reward.track_id into account_id,reward_track
    from public.rewards reward join public.loyalty_tracks track on track.id=reward.track_id
    join public.account_memberships membership on membership.account_id=track.account_id and membership.active and membership.is_primary
    where reward.id=requested_customer_reward_id and reward.status='available' and membership.profile_id=requested_customer_profile_id for update of reward;
    if account_id is null then raise exception 'A recompensa não pertence ao cliente identificado'; end if;
  elsif requested_reward_kind = 'projected' then
    if requested_customer_profile_id is null then raise exception 'Identifique o cliente'; end if;
    select membership.account_id, track.id, track.current_progress into account_id, reward_track, track_progress
    from public.account_memberships membership
    join public.loyalty_tracks track on track.account_id=membership.account_id and track.kind='main'
    where membership.profile_id=requested_customer_profile_id and membership.active and membership.is_primary
    for update of track;
    if account_id is null then raise exception 'Cartão do cliente não encontrado'; end if;
    if track_progress + (total_quantity - 1) < 14 then
      raise exception 'Esta compra ainda não completa o cartão do cliente';
    end if;
  elsif requested_reward_kind = 'manual' then
    if requested_customer_profile_id is not null then raise exception 'Fidelidade manual não pode ser usada com cliente identificado'; end if;
  end if;

  response := public.staff_create_manual_sale_in_cash_v6(
    requested_operation_key,target_session_id,target_draft_key,requested_customer_name,requested_customer_phone,
    requested_items,requested_payment_method,combined_discount,requested_payments,requested_notes,requested_change
  );
  v_order_id := (response->>'order_id')::uuid;
  select item.* into source_item from public.instant_order_items item where item.order_id=v_order_id and item.flavor_id=target_flavor_id and not item.is_reward for update;
  if source_item.id is null or target_unit_number > source_item.quantity then raise exception 'Não foi possível localizar a fatia escolhida'; end if;
  select * into reward_sauce from public.instant_order_item_sauces where order_item_id=source_item.id and unit_number=target_unit_number;

  if source_item.quantity = 1 then
    update public.instant_order_items set is_reward = true,unit_price=greatest(flavor_price-16,0),reward_id=case when requested_reward_kind='digital' then requested_customer_reward_id else null end,updated_at=now() where id=source_item.id;
    reward_item_id := source_item.id;
  else
    update public.instant_order_items set quantity = quantity - 1,updated_at=now() where id=source_item.id;
    delete from public.instant_order_item_sauces where order_item_id=source_item.id and unit_number=target_unit_number;
    update public.instant_order_item_sauces set unit_number=unit_number-1 where order_item_id=source_item.id and unit_number>target_unit_number;
    insert into public.instant_order_items(order_id,flavor_id,flavor_name,unit_price,quantity,status,is_reward,reward_id)
    values(v_order_id,target_flavor_id,source_item.flavor_name,greatest(flavor_price-16,0),1,source_item.status,true,case when requested_reward_kind='digital' then requested_customer_reward_id else null end)
    returning id into reward_item_id;
    if reward_sauce.id is not null then
      insert into public.instant_order_item_sauces(order_item_id,unit_number,sauce_id,sauce_name) values(reward_item_id,1,reward_sauce.sauce_id,reward_sauce.sauce_name);
    end if;
  end if;

  paid_quantity := total_quantity - 1;
  if requested_reward_kind in ('digital','projected') then
    -- O que a confirmacao do pagamento ja lancou para este pedido.
    select l.id, l.stamps_delta into auto_entry_id, auto_stamps from public.ledger_entries l
    where l.idempotency_key = 'instant-order:' || v_order_id::text || ':purchase' and l.track_id = reward_track;
    auto_stamps := coalesce(auto_stamps, 0);
    stamp_diff := paid_quantity - auto_stamps;
    if stamp_diff > 0 then
      perform public.staff_record_purchase(account_id,requested_customer_profile_id,least(stamp_diff,30)::smallint,requested_operation_key::text || ':purchase',null);
    elsif stamp_diff < 0 then
      perform private.cash_sale_stamp_reversal(reward_track, requested_customer_profile_id, -stamp_diff, requested_operation_key::text || ':reward-stamp', auto_entry_id);
    end if;
  end if;
  if requested_reward_kind = 'digital' then
    perform public.staff_redeem_reward(requested_customer_reward_id,flavor_price>16,greatest(flavor_price-16,0),requested_operation_key::text || ':reward');
  elsif requested_reward_kind = 'projected' then
    select reward.id into projected_reward_id from public.rewards reward
    where reward.track_id=reward_track and reward.status='available'
    order by reward.source_cycle limit 1 for update;
    if projected_reward_id is null then raise exception 'A fatia grátis não foi liberada por esta compra'; end if;
    perform public.staff_redeem_reward(projected_reward_id,flavor_price>16,greatest(flavor_price-16,0),requested_operation_key::text || ':reward');
    update public.instant_order_items set reward_id=projected_reward_id, updated_at=now() where id=reward_item_id;
  end if;
  insert into public.audit_events(actor_user_id,action,entity_type,entity_id,payload)
  values(actor,'cash.customer_loyalty_finalized','instant_order',v_order_id::text,jsonb_build_object('kind',requested_reward_kind,'reward_unit',requested_reward_unit,'paid_quantity',paid_quantity,'reward_id',coalesce(requested_customer_reward_id,projected_reward_id)));
  response := response || jsonb_build_object('total',greatest(0,subtotal-user_discount-reward_credit),'loyalty_recorded',requested_reward_kind in ('digital','projected'),'reward_item_id',reward_item_id,'paid_slices',paid_quantity);
  insert into private.cash_customer_loyalty_requests(operation_key,actor_id,response_payload) values(requested_operation_key,actor,response);
  return response;
end;
$function$;
