-- Mostra a previsao de carimbos somente ao proprio membro autenticado.
-- O telefone digitado sozinho nunca revela saldo ou premio de outra pessoa.
create or replace function public.member_instant_order_loyalty_preview(
  requested_phone text,
  requested_quantity integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_progress smallint;
  available_count integer := 0;
  safe_quantity integer := greatest(0, least(coalesce(requested_quantity, 0), 30));
  projected_total integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Entre no Clube Adoce para consultar seus carimbos';
  end if;

  select track.current_progress
  into member_progress
  from public.profiles profile
  join public.account_memberships membership
    on membership.profile_id = profile.id and membership.active and membership.is_primary
  join public.loyalty_accounts account
    on account.id = membership.account_id and account.active
  join public.loyalty_tracks track
    on track.account_id = account.id and track.kind = 'main'
  where profile.id = (select auth.uid())
    and profile.active
    and right(regexp_replace(coalesce(profile.phone_e164, ''), '\D', '', 'g'), 11) =
        right(regexp_replace(coalesce(requested_phone, ''), '\D', '', 'g'), 11);

  if member_progress is null then
    return jsonb_build_object('recognized', false);
  end if;

  select count(*)::integer
  into available_count
  from public.rewards reward
  join public.loyalty_tracks track on track.id = reward.track_id
  join public.account_memberships membership on membership.account_id = track.account_id
  where membership.profile_id = (select auth.uid())
    and membership.active and membership.is_primary
    and track.kind = 'main' and reward.status = 'available';

  projected_total := member_progress + safe_quantity;
  return jsonb_build_object(
    'recognized', true,
    'current_progress', member_progress,
    'purchase_quantity', safe_quantity,
    'projected_progress', projected_total % 14,
    'projected_new_rewards', projected_total / 14,
    'available_rewards', available_count,
    'will_unlock_reward', projected_total >= 14
  );
end;
$$;

revoke all on function public.member_instant_order_loyalty_preview(text,integer)
  from public, anon;
grant execute on function public.member_instant_order_loyalty_preview(text,integer)
  to authenticated;
