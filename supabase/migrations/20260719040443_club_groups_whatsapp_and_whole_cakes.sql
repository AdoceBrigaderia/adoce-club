-- Cadastro confiável por WhatsApp, catálogo de tortas G e cartão compartilhado.
-- Esta migração é aditiva: nenhum código, carimbo, prêmio ou histórico existente é apagado.

alter table public.profiles
  add column if not exists whatsapp_verified_at timestamptz;

alter table public.flavors
  add column if not exists whole_cake_price numeric(10,2),
  add column if not exists whole_cake_image_path text,
  add column if not exists whole_cake_available boolean not null default false;

alter table public.flavors
  drop constraint if exists flavors_whole_cake_price_positive,
  add constraint flavors_whole_cake_price_positive
    check (whole_cake_price is null or whole_cake_price > 0),
  drop constraint if exists flavors_whole_cake_complete,
  add constraint flavors_whole_cake_complete check (
    not whole_cake_available
    or (whole_cake_price is not null and nullif(trim(whole_cake_image_path), '') is not null)
  );

create table if not exists public.whatsapp_verification_challenges (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  phone_e164 text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  verified_at timestamptz,
  attempts smallint not null default 0 check (attempts between 0 and 10),
  created_at timestamptz not null default now()
);

create unique index if not exists whatsapp_one_open_challenge
  on public.whatsapp_verification_challenges(profile_id)
  where verified_at is null;
create index if not exists whatsapp_challenge_lookup
  on public.whatsapp_verification_challenges(phone_e164, expires_at desc)
  where verified_at is null;

alter table public.whatsapp_verification_challenges enable row level security;
revoke all on public.whatsapp_verification_challenges from public, anon, authenticated;

create or replace function private.normalize_br_phone(raw_phone text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  digits text := regexp_replace(coalesce(raw_phone, ''), '[^0-9]', '', 'g');
begin
  if left(digits, 2) = '55' then digits := substr(digits, 3); end if;
  if char_length(digits) not in (10, 11) then
    raise exception 'Informe um WhatsApp com DDD';
  end if;
  return '+55' || digits;
end;
$$;

revoke all on function private.normalize_br_phone(text) from public, anon, authenticated;

create or replace function public.begin_whatsapp_verification(raw_phone text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
    encode(digest(verification_code, 'sha256'), 'hex'), now() + interval '15 minutes'
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
$$;

revoke all on function public.begin_whatsapp_verification(text) from public, anon;
grant execute on function public.begin_whatsapp_verification(text) to authenticated;

create or replace function public.confirm_whatsapp_verification(sender_phone text, received_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
     or challenge.code_hash <> encode(digest(regexp_replace(received_code, '[^0-9]', '', 'g'), 'sha256'), 'hex') then
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
$$;

revoke all on function public.confirm_whatsapp_verification(text,text) from public, anon, authenticated;
grant execute on function public.confirm_whatsapp_verification(text,text) to service_role;

create or replace function public.whatsapp_verification_status()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'verified', whatsapp_verified_at is not null,
    'phone_e164', phone_e164,
    'verified_at', whatsapp_verified_at
  )
  from public.profiles where id = (select auth.uid());
$$;
revoke all on function public.whatsapp_verification_status() from public, anon;
grant execute on function public.whatsapp_verification_status() to authenticated;

create or replace function public.create_group_invite(group_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_profile_id uuid := (select auth.uid());
  target_account public.loyalty_accounts%rowtype;
  raw_token text := encode(gen_random_bytes(18), 'hex');
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
  values (target_account.id, encode(digest(raw_token, 'sha256'), 'hex'), current_profile_id, now() + interval '7 days')
  returning id into invite_id;

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values (current_profile_id, 'group.invite_created', 'loyalty_account', target_account.id::text,
    jsonb_build_object('invite_id', invite_id));
  return jsonb_build_object('invite_id', invite_id, 'token', raw_token, 'expires_at', now() + interval '7 days');
end;
$$;
revoke all on function public.create_group_invite(text) from public, anon;
grant execute on function public.create_group_invite(text) to authenticated;

create or replace function private.merge_individual_account(
  target_account_id uuid,
  source_account_id uuid,
  joining_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_kind public.account_kind;
  source_owner uuid;
  track_kind_value public.track_kind;
  target_track public.loyalty_tracks%rowtype;
  source_track public.loyalty_tracks%rowtype;
  combined_progress integer;
  extra_cycle integer;
  target_cycle_base integer;
begin
  if target_account_id = source_account_id then return; end if;
  select kind, owner_profile_id into source_kind, source_owner
  from public.loyalty_accounts where id = source_account_id for update;
  if source_kind <> 'individual' or source_owner <> joining_profile_id then
    raise exception 'Saia do cartão em grupo atual antes de aceitar outro convite';
  end if;

  foreach track_kind_value in array array['main'::public.track_kind, 'referral'::public.track_kind]
  loop
    select * into target_track from public.loyalty_tracks
    where account_id = target_account_id and kind = track_kind_value for update;
    select * into source_track from public.loyalty_tracks
    where account_id = source_account_id and kind = track_kind_value for update;
    if source_track.id is null then continue; end if;

    combined_progress := target_track.current_progress + source_track.current_progress;
    extra_cycle := combined_progress / 14;
    select coalesce(max(source_cycle), 0) into target_cycle_base
    from public.rewards where track_id = target_track.id;

    with moved as (
      select id, row_number() over (order by issued_at, id) as position
      from public.rewards where track_id = source_track.id
    )
    update public.rewards reward
    set track_id = target_track.id,
        source_cycle = target_cycle_base + moved.position
    from moved where reward.id = moved.id;

    update public.ledger_entries set track_id = target_track.id
    where track_id = source_track.id;

    update public.loyalty_tracks
    set current_progress = (combined_progress % 14)::smallint,
        completed_cards = target_track.completed_cards + source_track.completed_cards + extra_cycle,
        redeemed_rewards = target_track.redeemed_rewards + source_track.redeemed_rewards,
        updated_at = now()
    where id = target_track.id;

    if extra_cycle > 0 then
      insert into public.rewards(track_id, source_cycle)
      values (
        target_track.id,
        target_track.completed_cards + source_track.completed_cards + extra_cycle
      );
    end if;
    update public.loyalty_tracks
    set current_progress = 0, completed_cards = 0, redeemed_rewards = 0, updated_at = now()
    where id = source_track.id;
  end loop;

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values ((select auth.uid()), 'group.account_merged', 'loyalty_account', target_account_id::text,
    jsonb_build_object('source_account_id', source_account_id, 'joining_profile_id', joining_profile_id));
end;
$$;
revoke all on function private.merge_individual_account(uuid,uuid,uuid) from public, anon, authenticated;

create or replace function public.accept_group_invite(invite_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
  where token_hash = encode(digest(trim(invite_token), 'sha256'), 'hex')
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
$$;
revoke all on function public.accept_group_invite(text) from public, anon;
grant execute on function public.accept_group_invite(text) to authenticated;

create or replace function public.remove_group_member(member_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_profile_id uuid := (select auth.uid());
  group_account public.loyalty_accounts%rowtype;
  new_account_id uuid;
  member_name text;
begin
  select a.* into group_account from public.loyalty_accounts a
  where a.owner_profile_id = current_profile_id and a.kind = 'group' and a.active
  for update;
  if not found then raise exception 'Somente o proprietário pode remover membros'; end if;
  if member_profile_id = current_profile_id then raise exception 'O proprietário não pode remover a si mesmo'; end if;
  if not exists (select 1 from public.account_memberships where account_id = group_account.id and profile_id = member_profile_id and active) then
    raise exception 'Membro não encontrado neste cartão';
  end if;

  select full_name into member_name from public.profiles where id = member_profile_id;
  update public.account_memberships set active = false, is_primary = false
  where account_id = group_account.id and profile_id = member_profile_id;
  insert into public.loyalty_accounts(kind, name, owner_profile_id)
  values ('individual', member_name, member_profile_id) returning id into new_account_id;
  insert into public.account_memberships(account_id, profile_id, role, is_primary)
  values (new_account_id, member_profile_id, 'owner', true);
  insert into public.loyalty_tracks(account_id, kind) values (new_account_id, 'main'), (new_account_id, 'referral');
  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values (current_profile_id, 'group.member_removed', 'loyalty_account', group_account.id::text,
    jsonb_build_object('member_profile_id', member_profile_id, 'new_account_id', new_account_id));
  return jsonb_build_object('removed', true, 'new_account_id', new_account_id);
end;
$$;
revoke all on function public.remove_group_member(uuid) from public, anon;
grant execute on function public.remove_group_member(uuid) to authenticated;

create or replace function public.customer_group_overview()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select jsonb_build_object(
      'account_id', a.id,
      'kind', a.kind,
      'name', a.name,
      'is_owner', a.owner_profile_id = (select auth.uid()),
      'members', coalesce(jsonb_agg(jsonb_build_object(
        'profile_id', p.id, 'full_name', p.full_name, 'member_code', p.member_code,
        'role', m.role, 'joined_at', m.joined_at
      ) order by p.full_name) filter (where p.id is not null), '[]'::jsonb)
    )
    from public.account_memberships self
    join public.loyalty_accounts a on a.id = self.account_id and a.active
    join public.account_memberships m on m.account_id = a.id and m.active
    join public.profiles p on p.id = m.profile_id
    where self.profile_id = (select auth.uid()) and self.active and self.is_primary
    group by a.id
  ), '{}'::jsonb);
$$;
revoke all on function public.customer_group_overview() from public, anon;
grant execute on function public.customer_group_overview() to authenticated;

-- Antifraude de indicação: WhatsApp verificado e contas diferentes.
create or replace function public.accept_referral_invite(invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_profile_id uuid := (select auth.uid());
  referrer_id uuid;
  current_account_id uuid;
  referrer_account_id uuid;
  existing_referral public.referrals%rowtype;
begin
  if current_profile_id is null then raise exception 'Entre no Clube Adoce para aceitar o convite'; end if;
  if not exists (select 1 from public.profiles where id = current_profile_id and whatsapp_verified_at is not null) then
    raise exception 'Confirme seu WhatsApp antes de aceitar uma indicação';
  end if;
  select profile_id into referrer_id from public.referral_codes
  where code = upper(trim(invite_code)) and active;
  if referrer_id is null then raise exception 'Convite de indicação inválido ou desativado'; end if;
  if referrer_id = current_profile_id then raise exception 'Você não pode usar o próprio convite'; end if;
  if not exists (select 1 from public.profiles where id = referrer_id and whatsapp_verified_at is not null) then
    raise exception 'Este convite ainda não está habilitado';
  end if;

  select account_id into current_account_id from public.account_memberships
  where profile_id = current_profile_id and active and is_primary;
  select account_id into referrer_account_id from public.account_memberships
  where profile_id = referrer_id and active and is_primary;
  if current_account_id = referrer_account_id then
    insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
    values (current_profile_id, 'referral.same_group_blocked', 'profile', current_profile_id::text,
      jsonb_build_object('referrer_profile_id', referrer_id));
    raise exception 'Membros do mesmo cartão em grupo não geram indicação entre si';
  end if;

  select * into existing_referral from public.referrals where referred_profile_id = current_profile_id;
  if found then
    if existing_referral.referrer_profile_id <> referrer_id then raise exception 'Este cadastro já está vinculado a outro convite'; end if;
    return jsonb_build_object('status', existing_referral.status, 'accepted', false);
  end if;
  if exists (select 1 from public.ledger_entries where subject_profile_id = current_profile_id and reason = 'purchase') then
    raise exception 'O bônus de indicação é reservado antes da primeira compra';
  end if;
  insert into public.referrals(referrer_profile_id, referred_profile_id, code, status)
  values (referrer_id, current_profile_id, upper(trim(invite_code)), 'pending');
  return jsonb_build_object('status', 'pending', 'accepted', true);
end;
$$;
revoke all on function public.accept_referral_invite(text) from public, anon;
grant execute on function public.accept_referral_invite(text) to authenticated;

grant select (id, name, category, description, image_path, active, sort_order,
  created_at, short_description, ingredients, base_price, whole_cake_price,
  whole_cake_image_path, whole_cake_available)
on public.flavors to anon, authenticated;
grant update (phone_e164, whatsapp_verified_at) on public.profiles to service_role;

create or replace function private.enforce_referral_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  referrer_account uuid;
  referred_account uuid;
begin
  if new.status <> 'confirmed' or (tg_op = 'UPDATE' and old.status = 'confirmed') then return new; end if;
  if not exists (select 1 from public.profiles where id = new.referrer_profile_id and whatsapp_verified_at is not null)
     or not exists (select 1 from public.profiles where id = new.referred_profile_id and whatsapp_verified_at is not null) then
    raise exception 'A indicação exige WhatsApp confirmado para os dois membros';
  end if;
  select account_id into referrer_account from public.account_memberships
  where profile_id = new.referrer_profile_id and active and is_primary;
  select account_id into referred_account from public.account_memberships
  where profile_id = new.referred_profile_id and active and is_primary;
  if referrer_account = referred_account then
    raise exception 'Membros do mesmo cartão em grupo não geram indicação entre si';
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_referral_confirmation() from public, anon, authenticated;
drop trigger if exists referrals_enforce_confirmation on public.referrals;
create trigger referrals_enforce_confirmation
before insert or update of status on public.referrals
for each row execute function private.enforce_referral_confirmation();

create or replace function public.staff_redeem_group_reward(
  reward_id uuid,
  participant_profile_id uuid,
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
  result jsonb;
  reward_account_id uuid;
begin
  if (select auth.uid()) is null or not private.is_staff() then
    raise exception 'Acesso não autorizado';
  end if;
  select track.account_id into reward_account_id
  from public.rewards reward
  join public.loyalty_tracks track on track.id = reward.track_id
  where reward.id = staff_redeem_group_reward.reward_id;
  if not exists (
    select 1 from public.account_memberships membership
    where membership.account_id = reward_account_id
      and membership.profile_id = participant_profile_id and membership.active
  ) then raise exception 'O membro não pertence ao cartão desta recompensa'; end if;

  result := public.staff_redeem_reward(
    reward_id, premium_upgrade, price_difference, idempotency_key
  );
  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values ((select auth.uid()), 'group.reward_redeemed', 'loyalty_account', reward_account_id::text,
    jsonb_build_object('reward_id', reward_id, 'participant_profile_id', participant_profile_id));
  return result || jsonb_build_object('participant_profile_id', participant_profile_id);
end;
$$;
revoke all on function public.staff_redeem_group_reward(uuid,uuid,boolean,numeric,text) from public, anon;
grant execute on function public.staff_redeem_group_reward(uuid,uuid,boolean,numeric,text) to authenticated;
