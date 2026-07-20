create or replace function public.owner_remove_stamps(
  target_account_id uuid,
  target_profile_id uuid,
  quantity_to_remove smallint,
  adjustment_reason text,
  operation_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  track_row public.loyalty_tracks%rowtype;
  total_before integer;
  total_after integer;
  new_progress smallint;
  new_completed integer;
  cycles_removed integer;
  available_to_reverse integer;
  entry_id uuid;
  result jsonb;
begin
  if (select auth.uid()) is null or not exists (
    select 1
    from public.staff_members staff
    where staff.user_id = (select auth.uid())
      and staff.role = 'owner'
      and staff.active
  ) then
    raise exception 'Somente um proprietário pode corrigir carimbos';
  end if;

  if quantity_to_remove is null or quantity_to_remove < 1 or quantity_to_remove > 50 then
    raise exception 'Informe uma quantidade entre 1 e 50';
  end if;
  if adjustment_reason is null or char_length(trim(adjustment_reason)) < 5 then
    raise exception 'Informe o motivo da correção com pelo menos 5 caracteres';
  end if;
  if operation_key is null or char_length(operation_key) < 12 then
    raise exception 'Chave de idempotência inválida';
  end if;

  select metadata -> 'result' into result
  from public.ledger_entries
  where idempotency_key = operation_key;
  if found then return result; end if;

  if not exists (
    select 1
    from public.account_memberships membership
    where membership.account_id = target_account_id
      and membership.profile_id = target_profile_id
      and membership.active
  ) then
    raise exception 'Cliente não pertence à conta informada';
  end if;

  select * into track_row
  from public.loyalty_tracks track
  where track.account_id = target_account_id
    and track.kind = 'main'
  for update;
  if not found then raise exception 'Cartão principal não encontrado'; end if;

  total_before := track_row.completed_cards * 14 + track_row.current_progress;
  if quantity_to_remove > total_before then
    raise exception 'Não é possível remover mais carimbos do que o cliente possui';
  end if;

  total_after := total_before - quantity_to_remove;
  new_completed := total_after / 14;
  new_progress := (total_after % 14)::smallint;
  cycles_removed := track_row.completed_cards - new_completed;

  if exists (
    select 1 from public.rewards reward
    where reward.track_id = track_row.id
      and reward.source_cycle > new_completed
      and reward.status = 'redeemed'
  ) then
    raise exception 'A correção alcança um cartão cujo prêmio já foi resgatado. Revise o histórico antes de continuar';
  end if;

  if cycles_removed > 0 then
    select count(*)::integer into available_to_reverse
    from public.rewards reward
    where reward.track_id = track_row.id
      and reward.source_cycle > new_completed
      and reward.status = 'available';
    if available_to_reverse <> cycles_removed then
      raise exception 'Os prêmios vinculados não permitem esta correção automática';
    end if;

    update public.rewards reward
    set status = 'reversed', reversed_at = now()
    where reward.track_id = track_row.id
      and reward.source_cycle > new_completed
      and reward.status = 'available';
  end if;

  update public.loyalty_tracks
  set current_progress = new_progress,
      completed_cards = new_completed,
      updated_at = now()
  where id = track_row.id;

  result := jsonb_build_object(
    'track_id', track_row.id,
    'removed', quantity_to_remove,
    'previous_progress', track_row.current_progress,
    'previous_completed_cards', track_row.completed_cards,
    'progress', new_progress,
    'completed_cards', new_completed,
    'reversed_rewards', cycles_removed
  );

  insert into public.ledger_entries(
    track_id, subject_profile_id, actor_user_id, reason, stamps_delta,
    resulting_progress, resulting_completed_cards, idempotency_key, metadata
  ) values (
    track_row.id, target_profile_id, (select auth.uid()), 'reversal', -quantity_to_remove,
    new_progress, new_completed, operation_key,
    jsonb_build_object('reason', trim(adjustment_reason), 'result', result)
  ) returning id into entry_id;

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values (
    (select auth.uid()), 'stamps.corrected', 'loyalty_track', track_row.id::text,
    jsonb_build_object(
      'profile_id', target_profile_id,
      'quantity_removed', quantity_to_remove,
      'reason', trim(adjustment_reason),
      'ledger_entry_id', entry_id
    )
  );

  insert into public.outbox_events(topic, aggregate_type, aggregate_id, payload)
  values ('loyalty.changed', 'loyalty_track', track_row.id,
    jsonb_build_object('ledger_entry_id', entry_id, 'correction', true));

  return result || jsonb_build_object('ledger_entry_id', entry_id);
end;
$$;

revoke all on function public.owner_remove_stamps(uuid,uuid,smallint,text,text) from public, anon, authenticated;
grant execute on function public.owner_remove_stamps(uuid,uuid,smallint,text,text) to authenticated;
