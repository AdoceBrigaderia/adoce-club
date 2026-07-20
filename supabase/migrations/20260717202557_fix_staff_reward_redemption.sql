create or replace function public.staff_redeem_reward(
  reward_id uuid,
  premium_upgrade boolean,
  price_difference numeric,
  idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  reward_row public.rewards%rowtype;
begin
  if (select auth.uid()) is null or not private.is_staff() then
    raise exception 'Acesso não autorizado';
  end if;

  if staff_redeem_reward.idempotency_key is null
     or char_length(staff_redeem_reward.idempotency_key) < 12 then
    raise exception 'Chave de idempotência inválida';
  end if;

  if staff_redeem_reward.premium_upgrade
     and (staff_redeem_reward.price_difference is null
       or staff_redeem_reward.price_difference < 0) then
    raise exception 'Diferença da fatia premium inválida';
  end if;

  select * into reward_row
  from public.rewards
  where id = staff_redeem_reward.reward_id
  for update;

  if not found then
    raise exception 'Prêmio não encontrado';
  end if;

  if reward_row.redemption_idempotency_key = staff_redeem_reward.idempotency_key then
    return jsonb_build_object(
      'reward_id', staff_redeem_reward.reward_id,
      'status', reward_row.status
    );
  end if;

  if reward_row.status <> 'available' then
    raise exception 'Prêmio indisponível';
  end if;

  update public.rewards set
    status = 'redeemed',
    redeemed_at = now(),
    redeemed_by = (select auth.uid()),
    premium_upgrade = staff_redeem_reward.premium_upgrade,
    price_difference = case
      when staff_redeem_reward.premium_upgrade
        then staff_redeem_reward.price_difference
      else 0
    end,
    redemption_idempotency_key = staff_redeem_reward.idempotency_key
  where id = staff_redeem_reward.reward_id;

  update public.loyalty_tracks set
    redeemed_rewards = redeemed_rewards + 1,
    updated_at = now()
  where id = reward_row.track_id;

  insert into public.ledger_entries(
    track_id, actor_user_id, reason, stamps_delta, resulting_progress,
    resulting_completed_cards, idempotency_key, metadata
  )
  select
    id,
    (select auth.uid()),
    'reward_redeemed',
    0,
    current_progress,
    completed_cards,
    staff_redeem_reward.idempotency_key,
    jsonb_build_object(
      'reward_id', staff_redeem_reward.reward_id,
      'premium_upgrade', staff_redeem_reward.premium_upgrade,
      'price_difference', case
        when staff_redeem_reward.premium_upgrade
          then staff_redeem_reward.price_difference
        else 0
      end
    )
  from public.loyalty_tracks
  where id = reward_row.track_id;

  insert into public.outbox_events(topic, aggregate_type, aggregate_id, payload)
  values (
    'reward.redeemed',
    'reward',
    staff_redeem_reward.reward_id,
    jsonb_build_object('track_id', reward_row.track_id)
  );

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values (
    (select auth.uid()),
    'reward.redeemed',
    'reward',
    staff_redeem_reward.reward_id::text,
    jsonb_build_object(
      'premium_upgrade', staff_redeem_reward.premium_upgrade,
      'price_difference', case
        when staff_redeem_reward.premium_upgrade
          then staff_redeem_reward.price_difference
        else 0
      end
    )
  );

  return jsonb_build_object(
    'reward_id', staff_redeem_reward.reward_id,
    'status', 'redeemed'
  );
end;
$$;

revoke all on function public.staff_redeem_reward(uuid,boolean,numeric,text) from public, anon;
grant execute on function public.staff_redeem_reward(uuid,boolean,numeric,text) to authenticated;
