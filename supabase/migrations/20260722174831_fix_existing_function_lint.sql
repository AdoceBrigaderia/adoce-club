-- Qualify extension functions and fix legacy type mismatches reported by
-- `supabase db lint --linked --schema public --level error`.

create or replace function public.begin_whatsapp_verification(raw_phone text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_profile_id uuid := (select auth.uid());
  normalized_phone text;
  verification_code text;
  challenge_id uuid;
begin
  if current_profile_id is null then raise exception 'Sessão obrigatória'; end if;
  normalized_phone := private.normalize_br_phone(raw_phone);

  if exists (
    select 1 from public.profiles
    where phone_e164 = normalized_phone and id <> current_profile_id
  ) then
    insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
    values (current_profile_id, 'whatsapp.duplicate_phone_blocked', 'profile', current_profile_id::text,
      jsonb_build_object('phone_suffix', right(normalized_phone, 4)));
    raise exception 'Este WhatsApp já está vinculado a outro Membro do Clube Adoce';
  end if;

  verification_code := lpad((floor(random() * 1000000))::integer::text, 6, '0');
  delete from public.whatsapp_verification_challenges
  where profile_id = current_profile_id and verified_at is null;

  insert into public.whatsapp_verification_challenges(
    profile_id, phone_e164, code_hash, expires_at
  ) values (
    current_profile_id, normalized_phone,
    encode(extensions.digest(verification_code, 'sha256'), 'hex'), now() + interval '15 minutes'
  ) returning id into challenge_id;

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values (current_profile_id, 'whatsapp.verification_started', 'profile', current_profile_id::text,
    jsonb_build_object('challenge_id', challenge_id, 'phone_suffix', right(normalized_phone, 4)));

  return jsonb_build_object(
    'challenge_id', challenge_id,
    'phone_e164', normalized_phone,
    'verification_code', verification_code,
    'expires_at', now() + interval '15 minutes'
  );
end;
$function$;

create or replace function public.confirm_whatsapp_verification(sender_phone text, received_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  normalized_phone text := private.normalize_br_phone(sender_phone);
  challenge public.whatsapp_verification_challenges%rowtype;
begin
  select * into challenge
  from public.whatsapp_verification_challenges
  where phone_e164 = normalized_phone
    and verified_at is null
    and expires_at > now()
  order by created_at desc
  limit 1
  for update;

  if not found then return jsonb_build_object('verified', false, 'reason', 'not_found'); end if;

  update public.whatsapp_verification_challenges
  set attempts = least(attempts + 1, 10)
  where id = challenge.id;

  if challenge.attempts >= 5
     or challenge.code_hash <> encode(extensions.digest(regexp_replace(received_code, '[^0-9]', '', 'g'), 'sha256'), 'hex') then
    insert into public.audit_events(action, entity_type, entity_id, payload)
    values ('whatsapp.verification_failed', 'profile', challenge.profile_id::text,
      jsonb_build_object('challenge_id', challenge.id, 'attempt', challenge.attempts + 1));
    return jsonb_build_object('verified', false, 'reason', 'invalid_code');
  end if;

  update public.profiles
  set phone_e164 = normalized_phone, whatsapp_verified_at = now(), updated_at = now()
  where id = challenge.profile_id;
  update public.whatsapp_verification_challenges set verified_at = now() where id = challenge.id;

  insert into public.audit_events(action, entity_type, entity_id, payload)
  values ('whatsapp.verified', 'profile', challenge.profile_id::text,
    jsonb_build_object('challenge_id', challenge.id, 'phone_suffix', right(normalized_phone, 4)));
  return jsonb_build_object('verified', true, 'profile_id', challenge.profile_id);
end;
$function$;

create or replace function public.create_group_invite(group_name text default null::text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_profile_id uuid := (select auth.uid());
  target_account public.loyalty_accounts%rowtype;
  raw_token text := encode(extensions.gen_random_bytes(18), 'hex');
  invite_id uuid;
begin
  if current_profile_id is null then raise exception 'Sessão obrigatória'; end if;
  if not exists (select 1 from public.profiles where id = current_profile_id and whatsapp_verified_at is not null) then
    raise exception 'Confirme seu WhatsApp antes de criar um cartão em grupo';
  end if;

  select a.* into target_account
  from public.loyalty_accounts a
  join public.account_memberships m on m.account_id = a.id
  where m.profile_id = current_profile_id and m.active and m.is_primary and m.role = 'owner'
  for update of a;
  if not found then raise exception 'Somente o proprietário pode convidar pessoas'; end if;

  update public.loyalty_accounts
  set kind = 'group', name = coalesce(nullif(trim(group_name), ''), name), updated_at = now()
  where id = target_account.id;

  insert into public.group_invites(account_id, token_hash, created_by, expires_at)
  values (target_account.id, encode(extensions.digest(raw_token, 'sha256'), 'hex'), current_profile_id, now() + interval '7 days')
  returning id into invite_id;

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values (current_profile_id, 'group.invite_created', 'loyalty_account', target_account.id::text,
    jsonb_build_object('invite_id', invite_id));
  return jsonb_build_object('invite_id', invite_id, 'token', raw_token, 'expires_at', now() + interval '7 days');
end;
$function$;

create or replace function public.accept_group_invite(invite_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_profile_id uuid := (select auth.uid());
  invite public.group_invites%rowtype;
  source_account_id uuid;
  member_count integer;
begin
  if current_profile_id is null then raise exception 'Sessão obrigatória'; end if;
  if not exists (select 1 from public.profiles where id = current_profile_id and whatsapp_verified_at is not null) then
    raise exception 'Confirme seu WhatsApp antes de entrar em um cartão em grupo';
  end if;

  select * into invite from public.group_invites
  where token_hash = encode(extensions.digest(trim(invite_token), 'sha256'), 'hex')
    and revoked_at is null and accepted_at is null and expires_at > now()
  for update;
  if not found then raise exception 'Convite de grupo inválido ou expirado'; end if;
  if invite.created_by = current_profile_id then raise exception 'Você já é proprietário deste cartão'; end if;

  select count(*) into member_count from public.account_memberships
  where account_id = invite.account_id and active;
  if member_count >= 5 then raise exception 'Este cartão em grupo já atingiu o limite de 5 membros'; end if;

  select account_id into source_account_id from public.account_memberships
  where profile_id = current_profile_id and active and is_primary for update;
  if source_account_id = invite.account_id then raise exception 'Você já faz parte deste cartão em grupo'; end if;

  perform private.merge_individual_account(invite.account_id, source_account_id, current_profile_id);

  update public.account_memberships set active = false, is_primary = false
  where account_id = source_account_id and profile_id = current_profile_id;
  update public.loyalty_accounts set active = false, updated_at = now()
  where id = source_account_id;
  insert into public.account_memberships(account_id, profile_id, role, is_primary, active)
  values (invite.account_id, current_profile_id, 'member', true, true)
  on conflict (account_id, profile_id) do update
    set role = 'member', is_primary = true, active = true, joined_at = now();
  update public.group_invites set accepted_by = current_profile_id, accepted_at = now() where id = invite.id;

  update public.referrals set status = 'rejected'
  where status = 'pending' and (
    (referrer_profile_id = invite.created_by and referred_profile_id = current_profile_id)
    or (referrer_profile_id = current_profile_id and referred_profile_id = invite.created_by)
  );

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values (current_profile_id, 'group.invite_accepted', 'loyalty_account', invite.account_id::text,
    jsonb_build_object('invite_id', invite.id, 'previous_account_id', source_account_id));
  return jsonb_build_object('accepted', true, 'account_id', invite.account_id);
end;
$function$;

create or replace function public.staff_search_customers(search_text text default ''::text)
returns table(profile_id uuid, account_id uuid, full_name text, phone_e164 text, email text, current_progress smallint, completed_cards integer, available_rewards bigint, available_reward_id uuid)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null or not private.is_staff() then
    raise exception 'Acesso não autorizado';
  end if;

  return query
  select
    p.id,
    a.id,
    p.full_name,
    p.phone_e164,
    p.email,
    t.current_progress,
    t.completed_cards,
    count(r.id) filter (where r.status = 'available')::bigint,
    (min(r.id::text) filter (where r.status = 'available'))::uuid
  from public.profiles p
  join public.account_memberships m
    on m.profile_id = p.id and m.active and m.is_primary
  join public.loyalty_accounts a on a.id = m.account_id and a.active
  join public.loyalty_tracks t on t.account_id = a.id and t.kind = 'main'
  left join public.rewards r on r.track_id = t.id
  where search_text is null
     or trim(search_text) = ''
     or lower(p.full_name) like '%' || lower(trim(search_text)) || '%'
     or coalesce(p.phone_e164, '') like '%' || regexp_replace(search_text, '[^0-9]', '', 'g') || '%'
     or lower(coalesce(p.email, '')) like '%' || lower(trim(search_text)) || '%'
  group by p.id, a.id, p.full_name, p.phone_e164, p.email,
           t.current_progress, t.completed_cards, p.updated_at
  order by p.updated_at desc
  limit 30;
end;
$function$;

create or replace function public.staff_record_purchase(account_id uuid, participant_profile_id uuid, quantity smallint, idempotency_key text, referral_code text default null::text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  main_track_id uuid;
  purchase_result jsonb;
  pending_referral public.referrals%rowtype;
  referrer_id uuid;
  referrer_track_id uuid;
  purchase_entry_id uuid;
begin
  if (select auth.uid()) is null or not private.is_staff() then
    raise exception 'Acesso não autorizado';
  end if;
  if idempotency_key is null or char_length(idempotency_key) < 12 then
    raise exception 'Chave de idempotência inválida';
  end if;
  if not exists (
    select 1 from public.account_memberships m
    where m.account_id = staff_record_purchase.account_id
      and m.profile_id = participant_profile_id and m.active
  ) then raise exception 'Participante não pertence à conta'; end if;

  select id into main_track_id from public.loyalty_tracks
  where loyalty_tracks.account_id = staff_record_purchase.account_id and kind = 'main';

  purchase_result := private.advance_track(
    main_track_id, quantity, participant_profile_id, 'purchase'::public.ledger_reason,
    idempotency_key, jsonb_build_object('quantity', quantity)
  );
  purchase_entry_id := (purchase_result ->> 'ledger_entry_id')::uuid;

  if (select count(*) from public.ledger_entries
      where subject_profile_id = participant_profile_id and reason = 'purchase') = 1 then
    select * into pending_referral
    from public.referrals
    where referred_profile_id = participant_profile_id and status = 'pending'
    for update;

    if not found and referral_code is not null then
      select profile_id into referrer_id from public.referral_codes
      where code = upper(trim(referral_code)) and active and profile_id <> participant_profile_id;
      if referrer_id is not null then
        insert into public.referrals(referrer_profile_id, referred_profile_id, code, status)
        values (referrer_id, participant_profile_id, upper(trim(referral_code)), 'pending')
        returning * into pending_referral;
      end if;
    end if;

    if pending_referral.id is not null then
      referrer_id := pending_referral.referrer_profile_id;
      update public.referrals
      set status = 'confirmed', first_purchase_ledger_id = purchase_entry_id, confirmed_at = now()
      where id = pending_referral.id;

      perform private.advance_track(
        main_track_id, 1::smallint, participant_profile_id, 'referral_referred'::public.ledger_reason,
        idempotency_key || ':referred', jsonb_build_object('referrer_id', referrer_id)
      );

      select t.id into referrer_track_id
      from public.loyalty_tracks t
      join public.account_memberships m on m.account_id = t.account_id
      where m.profile_id = referrer_id and m.is_primary and m.active and t.kind = 'referral';

      perform private.advance_track(
        referrer_track_id, 1::smallint, referrer_id, 'referral_referrer'::public.ledger_reason,
        idempotency_key || ':referrer', jsonb_build_object('referred_profile_id', participant_profile_id)
      );
    end if;
  end if;

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values ((select auth.uid()), 'purchase.recorded', 'loyalty_account', account_id::text,
    jsonb_build_object('quantity', quantity, 'participant_profile_id', participant_profile_id));

  return purchase_result || jsonb_build_object(
    'referral_confirmed', pending_referral.id is not null
  );
end;
$function$;
