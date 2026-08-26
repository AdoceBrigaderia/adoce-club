begin;

create or replace function public.customer_get_account_workspace()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  profile_row public.profiles%rowtype;
  account_id uuid;
  main_track public.loyalty_tracks%rowtype;
  referral_track public.loyalty_tracks%rowtype;
begin
  if current_user_id is null then
    raise exception 'Sessao do Clube obrigatoria';
  end if;

  select * into profile_row
  from public.profiles p
  where p.id = current_user_id
  for share;

  if profile_row.id is null or not coalesce(profile_row.active, true) then
    raise exception 'Cadastro do Clube nao encontrado';
  end if;

  if coalesce(profile_row.account_status::text, 'active') <> 'active' then
    raise exception 'Este cadastro precisa de atendimento';
  end if;

  select membership.account_id into account_id
  from public.account_memberships membership
  where membership.profile_id = current_user_id
    and membership.active
  order by membership.is_primary desc, membership.created_at
  limit 1;

  if account_id is not null then
    select * into main_track
    from public.loyalty_tracks track
    where track.account_id = account_id and track.kind::text = 'main'
    limit 1;

    select * into referral_track
    from public.loyalty_tracks track
    where track.account_id = account_id and track.kind::text = 'referral'
    limit 1;
  end if;

  return jsonb_build_object(
    'profile', jsonb_build_object(
      'id', profile_row.id,
      'full_name', profile_row.full_name,
      'member_code', profile_row.member_code,
      'phone_e164', profile_row.phone_e164,
      'email', coalesce((select auth.jwt() ->> 'email'), ''),
      'whatsapp_verified', profile_row.whatsapp_verified_at is not null,
      'account_status', profile_row.account_status::text
    ),
    'loyalty', jsonb_build_object(
      'current_progress', coalesce(main_track.current_progress, 0),
      'completed_cards', coalesce(main_track.completed_cards, 0),
      'available_rewards', coalesce((
        select count(*)::integer
        from public.rewards reward
        where reward.track_id = main_track.id
          and reward.status::text = 'available'
      ), 0)
    ),
    'referral', jsonb_build_object(
      'code', coalesce((
        select referral.code
        from public.referral_codes referral
        where referral.profile_id = current_user_id
        limit 1
      ), ''),
      'current_progress', coalesce(referral_track.current_progress, 0),
      'completed_cards', coalesce(referral_track.completed_cards, 0)
    ),
    'consents', coalesce((
      select jsonb_object_agg(latest.consent_type, latest.granted)
      from (
        select distinct on (event.consent_type)
          event.consent_type::text as consent_type,
          event.granted
        from public.consent_events event
        where event.profile_id = current_user_id
        order by event.consent_type, event.created_at desc
      ) latest
    ), '{}'::jsonb),
    'preferences', coalesce((
      select to_jsonb(preference) - 'profile_id'
      from public.notification_preferences preference
      where preference.profile_id = current_user_id
      limit 1
    ), '{}'::jsonb),
    'recent_movements', coalesce((
      select jsonb_agg(to_jsonb(entry) order by entry.created_at desc)
      from (
        select
          ledger.id,
          ledger.reason::text as reason,
          ledger.stamps_delta,
          ledger.resulting_progress,
          ledger.created_at
        from public.ledger_entries ledger
        where ledger.track_id in (main_track.id, referral_track.id)
        order by ledger.created_at desc
        limit 12
      ) entry
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.customer_get_account_workspace() from public, anon;
grant execute on function public.customer_get_account_workspace() to authenticated;

commit;
