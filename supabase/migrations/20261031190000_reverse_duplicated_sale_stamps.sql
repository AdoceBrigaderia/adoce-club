-- Estorno dos carimbos lancados em dobro (autorizado pelo proprietario em
-- 31/10/2026). Entre 13/10 e 30/10/2026 o cadastro no Clube no fechamento da
-- venda (staff-enroll-sale-customer, chave sale-order:<id>) lancou de novo os
-- carimbos que o caixa ja tinha lancado (instant-order:<id>:purchase).
-- Para cada lancamento repetido entra um 'reversal' ligado a ele
-- (related_entry_id), com a mesma regra de owner_remove_stamps: o cartao
-- volta ao total correto e a fatia gratis que so existia por causa dos
-- carimbos dobrados (nao retirada) passa a 'reversed'. Nada e apagado.
-- Se algum premio ja resgatado fosse alcancado, a operacao inteira falha.
-- Nenhuma mensagem automatica e enviada (sem outbox loyalty.changed).

do $$
declare
  dup record;
  track_row public.loyalty_tracks%rowtype;
  total_after integer;
  new_completed integer;
  new_progress smallint;
  cycles_removed integer;
  available_to_reverse integer;
  entry_id uuid;
begin
  for dup in
    select s.*
    from public.ledger_entries s
    where s.reason = 'purchase'
      and s.idempotency_key ~ '^sale-order:[0-9a-f-]{36}$'
      and exists (
        select 1 from public.ledger_entries i
        where i.reason = 'purchase'
          and i.idempotency_key = 'instant-order:' || substring(s.idempotency_key from 12) || ':purchase'
      )
      and not exists (
        select 1 from public.ledger_entries r
        where r.idempotency_key = 'dup-reversal:' || s.id::text
      )
    order by s.track_id, s.created_at
  loop
    select * into track_row from public.loyalty_tracks where id = dup.track_id for update;

    total_after := track_row.completed_cards * 14 + track_row.current_progress - dup.stamps_delta;
    if total_after < 0 then
      raise exception 'Estorno deixaria o cartao % negativo', track_row.id;
    end if;
    new_completed := total_after / 14;
    new_progress := (total_after % 14)::smallint;
    cycles_removed := track_row.completed_cards - new_completed;

    if exists (
      select 1 from public.rewards w
      where w.track_id = track_row.id and w.source_cycle > new_completed and w.status = 'redeemed'
    ) then
      raise exception 'Estorno alcanca premio ja resgatado no cartao %', track_row.id;
    end if;

    if cycles_removed > 0 then
      select count(*)::integer into available_to_reverse
      from public.rewards w
      where w.track_id = track_row.id and w.source_cycle > new_completed and w.status = 'available';
      if available_to_reverse <> cycles_removed then
        raise exception 'Premios do cartao % nao permitem o estorno automatico', track_row.id;
      end if;
      update public.rewards w
      set status = 'reversed', reversed_at = now()
      where w.track_id = track_row.id and w.source_cycle > new_completed and w.status = 'available';
    end if;

    update public.loyalty_tracks
    set current_progress = new_progress, completed_cards = new_completed, updated_at = now()
    where id = track_row.id;

    insert into public.ledger_entries (
      track_id, subject_profile_id, actor_user_id, reason, stamps_delta,
      resulting_progress, resulting_completed_cards, idempotency_key, related_entry_id, metadata
    ) values (
      track_row.id, dup.subject_profile_id, null, 'reversal', -dup.stamps_delta,
      new_progress, new_completed, 'dup-reversal:' || dup.id::text, dup.id,
      jsonb_build_object(
        'reason', 'Carimbo lancado em dobro no fechamento da venda',
        'result', jsonb_build_object(
          'track_id', track_row.id,
          'removed', dup.stamps_delta,
          'previous_progress', track_row.current_progress,
          'previous_completed_cards', track_row.completed_cards,
          'progress', new_progress,
          'completed_cards', new_completed,
          'reversed_rewards', greatest(cycles_removed, 0)
        )
      )
    ) returning id into entry_id;

    insert into public.audit_events (actor_user_id, action, entity_type, entity_id, payload)
    values (null, 'stamps.duplicate_reversed', 'loyalty_track', track_row.id::text,
      jsonb_build_object('profile_id', dup.subject_profile_id, 'quantity_removed', dup.stamps_delta,
                         'duplicated_entry_id', dup.id, 'ledger_entry_id', entry_id,
                         'reversed_rewards', greatest(cycles_removed, 0)));
  end loop;
end $$;
