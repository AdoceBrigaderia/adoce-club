begin;

-- Corrige um bug real: a reversão de carimbos duplicados (20261031190000_reverse_duplicated_sale_stamps.sql)
-- voltou loyalty_tracks.completed_cards pra trás, mas manteve a linha de rewards já emitida (status
-- 'reversed') com o mesmo source_cycle, para preservar o histórico. Como rewards.(track_id, source_cycle)
-- é único, isso deixa aquele número de ciclo permanentemente "ocupado": a próxima vez que o cliente
-- completa um cartão, advance_track tenta inserir o mesmo source_cycle de novo e o pagamento do pedido
-- falha com "duplicate key value violates unique constraint rewards_track_id_source_cycle_key".
-- Confirmado em produção em 02/11/2026, bloqueando o pedido FAT-20261102-1604 do cliente Iago Pessoa,
-- e afeta mais 7 contas na mesma situação (Rian Ribeiro, Wesley Carvalho, Carolina Marciel, Pablicia
-- Nascimento, Gabriela Matos, Cristiane Vieira, Danielle Clemente).

-- 1) Sincroniza completed_cards para nunca ficar atrás do maior source_cycle já usado (de qualquer
--    status) -- o próximo ciclo sempre usa um número livre. Não altera current_progress (carimbos do
--    cartão atual) nem nenhuma linha de rewards.
update public.loyalty_tracks t
set completed_cards = sub.max_cycle, updated_at = clock_timestamp()
from (
  select track_id, max(source_cycle) as max_cycle from public.rewards group by track_id
) sub
where t.id = sub.track_id and sub.max_cycle > t.completed_cards;

-- 2) Blinda advance_track contra o mesmo desalinhamento no futuro: nunca reutiliza um source_cycle
--    já existente, mesmo que completed_cards esteja atrasado por algum motivo. Sem essa guarda, o
--    mesmo tipo de ajuste manual feito numa reversão futura voltaria a travar pagamentos.
create or replace function private.advance_track(target_track_id uuid, points smallint, subject_id uuid, operation_reason ledger_reason, operation_key text, operation_metadata jsonb DEFAULT '{}'::jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $$
declare
  track_row public.loyalty_tracks%rowtype;
  total_points integer;
  cycles integer;
  new_progress smallint;
  start_cycle integer;
  entry_id uuid;
  result jsonb;
begin
  if points <= 0 or points > 50 then
    raise exception 'Quantidade de carimbos inválida';
  end if;

  select metadata -> 'result' into result
  from public.ledger_entries where idempotency_key = operation_key;
  if found then return result; end if;

  select * into track_row from public.loyalty_tracks
  where id = target_track_id for update;
  if not found then raise exception 'Trilha não encontrada'; end if;

  total_points := track_row.current_progress + points;
  cycles := total_points / 14;
  new_progress := (total_points % 14)::smallint;
  start_cycle := greatest(
    track_row.completed_cards,
    coalesce((select max(source_cycle) from public.rewards where track_id = target_track_id), 0)
  );

  update public.loyalty_tracks
  set current_progress = new_progress,
      completed_cards = start_cycle + cycles,
      updated_at = now()
  where id = target_track_id;

  if cycles > 0 then
    insert into public.rewards(track_id, source_cycle)
    select target_track_id, start_cycle + n
    from generate_series(1, cycles) as n;
  end if;

  result := jsonb_build_object(
    'track_id', target_track_id,
    'progress', new_progress,
    'completed_cards', start_cycle + cycles,
    'new_rewards', cycles
  );

  insert into public.ledger_entries(
    track_id, subject_profile_id, actor_user_id, reason, stamps_delta,
    resulting_progress, resulting_completed_cards, idempotency_key, metadata
  ) values (
    target_track_id, subject_id, (select auth.uid()), operation_reason, points,
    new_progress, start_cycle + cycles, operation_key,
    operation_metadata || jsonb_build_object('result', result)
  ) returning id into entry_id;

  insert into public.outbox_events(topic, aggregate_type, aggregate_id, payload)
  values ('loyalty.changed', 'loyalty_track', target_track_id,
    jsonb_build_object('ledger_entry_id', entry_id));

  return result || jsonb_build_object('ledger_entry_id', entry_id);
end;
$$;

commit;
