begin;

create or replace function public.staff_record_referral_stamps(
  target_profile_id uuid,
  quantity smallint,
  operation_key text,
  adjustment_reason text default 'Indicação confirmada no atendimento'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_account_id uuid;
  referral_track_id uuid;
  result jsonb;
begin
  if (select auth.uid()) is null or not private.is_staff() then
    raise exception 'Acesso não autorizado';
  end if;
  if quantity is null or quantity < 1 or quantity > 20 then
    raise exception 'Informe entre 1 e 20 indicações';
  end if;
  if operation_key is null or char_length(operation_key) < 12 then
    raise exception 'Chave de idempotência inválida';
  end if;
  if char_length(trim(coalesce(adjustment_reason, ''))) < 5 then
    raise exception 'Informe o motivo da indicação';
  end if;
  select account_id into target_account_id
  from public.account_memberships
  where profile_id = target_profile_id and is_primary and active
  limit 1;
  if target_account_id is null then raise exception 'Cliente sem conta ativa'; end if;
  select id into referral_track_id
  from public.loyalty_tracks
  where account_id = target_account_id and kind = 'referral';
  if referral_track_id is null then raise exception 'Cartão de indicação não encontrado'; end if;
  result := private.advance_track(
    referral_track_id,
    quantity,
    target_profile_id,
    'referral_referrer'::public.ledger_reason,
    operation_key,
    jsonb_build_object('reason', trim(adjustment_reason), 'manual', true)
  );
  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values ((select auth.uid()), 'referral.stamps.recorded', 'loyalty_track', referral_track_id::text,
    jsonb_build_object('profile_id', target_profile_id, 'quantity', quantity, 'reason', trim(adjustment_reason)));
  return result || jsonb_build_object('quantity', quantity, 'reason', trim(adjustment_reason));
end;
$$;

revoke all on function public.staff_record_referral_stamps(uuid,smallint,text,text) from public, anon;
grant execute on function public.staff_record_referral_stamps(uuid,smallint,text,text) to authenticated;

commit;
