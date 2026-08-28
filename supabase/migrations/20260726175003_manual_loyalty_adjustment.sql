begin;

create or replace function public.staff_adjust_loyalty_stamps(
  target_account_id uuid,
  target_profile_id uuid,
  stamps_delta smallint,
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
  existing_result jsonb;
  result jsonb;
  total_before integer;
  total_after integer;
  new_progress smallint;
  new_completed integer;
  cycles_removed integer;
  available_to_reverse integer;
  entry_id uuid;
begin
  if (select auth.uid()) is null
     or not private.staff_has_any_capability('manage_loyalty') then
    raise exception 'Voce nao possui permissao para ajustar fidelidade';
  end if;

  if stamps_delta is null or stamps_delta = 0
     or stamps_delta < -50 or stamps_delta > 50 then
    raise exception 'Informe uma quantidade entre -50 e 50, diferente de zero';
  end if;
  if adjustment_reason is null or char_length(trim(adjustment_reason)) < 3 then
    raise exception 'Informe um motivo com pelo menos 3 caracteres';
  end if;
  if operation_key is null or char_length(operation_key) < 12 then
    raise exception 'Chave de idempotencia invalida';
  end if;

  select metadata -> 'result' into existing_result
  from public.ledger_entries
  where idempotency_key = operation_key;
  if found then return existing_result; end if;

  if not exists (
    select 1
    from public.account_memberships membership
    where membership.account_id = target_account_id
      and membership.profile_id = target_profile_id
      and membership.active
  ) then
    raise exception 'Cliente nao pertence a conta informada';
  end if;

  select * into track_row
  from public.loyalty_tracks track
  where track.account_id = target_account_id
    and track.kind = 'main'
  for update;
  if not found then raise exception 'Cartao principal nao encontrado'; end if;

  if stamps_delta > 0 then
    result := private.advance_track(
      track_row.id,
      stamps_delta,
      target_profile_id,
      'manual_adjustment'::public.ledger_reason,
      operation_key,
      jsonb_build_object(
        'reason', trim(adjustment_reason),
        'source', 'operation_manual_adjustment',
        'direction', 'add'
      )
    );
  else
    total_before := track_row.completed_cards * 14 + track_row.current_progress;
    if abs(stamps_delta) > total_before then
      raise exception 'Nao e possivel remover mais carimbos do que o cliente possui';
    end if;

    total_after := total_before + stamps_delta;
    new_completed := total_after / 14;
    new_progress := (total_after % 14)::smallint;
    cycles_removed := track_row.completed_cards - new_completed;

    if exists (
      select 1
      from public.rewards reward
      where reward.track_id = track_row.id
        and reward.source_cycle > new_completed
        and reward.status = 'redeemed'
    ) then
      raise exception 'A correcao alcanca um premio ja resgatado. Revise o historico';
    end if;

    if cycles_removed > 0 then
      select count(*)::integer into available_to_reverse
      from public.rewards reward
      where reward.track_id = track_row.id
        and reward.source_cycle > new_completed
        and reward.status = 'available';
      if available_to_reverse <> cycles_removed then
        raise exception 'Os premios vinculados nao permitem esta correcao automatica';
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
      'progress', new_progress,
      'completed_cards', new_completed,
      'new_rewards', 0,
      'reversed_rewards', cycles_removed
    );

    insert into public.ledger_entries(
      track_id, subject_profile_id, actor_user_id, reason, stamps_delta,
      resulting_progress, resulting_completed_cards, idempotency_key, metadata
    ) values (
      track_row.id,
      target_profile_id,
      (select auth.uid()),
      'manual_adjustment',
      stamps_delta,
      new_progress,
      new_completed,
      operation_key,
      jsonb_build_object(
        'reason', trim(adjustment_reason),
        'source', 'operation_manual_adjustment',
        'direction', 'remove',
        'result', result
      )
    ) returning id into entry_id;

    insert into public.outbox_events(topic, aggregate_type, aggregate_id, payload)
    values (
      'loyalty.changed',
      'loyalty_track',
      track_row.id,
      jsonb_build_object('ledger_entry_id', entry_id, 'manual_adjustment', true)
    );

    result := result || jsonb_build_object('ledger_entry_id', entry_id);
  end if;

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values (
    (select auth.uid()),
    'loyalty.manual_adjustment',
    'loyalty_track',
    track_row.id::text,
    jsonb_build_object(
      'profile_id', target_profile_id,
      'account_id', target_account_id,
      'stamps_delta', stamps_delta,
      'reason', trim(adjustment_reason),
      'operation_key', operation_key,
      'result', result
    )
  );

  return result;
end;
$$;

revoke all on function public.staff_adjust_loyalty_stamps(uuid,uuid,smallint,text,text) from public, anon;
grant execute on function public.staff_adjust_loyalty_stamps(uuid,uuid,smallint,text,text) to authenticated;

commit;
