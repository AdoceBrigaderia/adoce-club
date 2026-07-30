begin;

create or replace function public.customer_complete_registration(
  next_full_name text,
  next_phone_e164 text,
  next_marketing boolean default false,
  target_whatsapp_challenge_id uuid default null,
  target_referral_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_profile_id uuid := (select auth.uid());
  normalized_name text := private.normalize_person_name(next_full_name);
  normalized_phone text := pg_catalog.regexp_replace(coalesce(next_phone_e164, ''), '\D', '', 'g');
  claimed_whatsapp jsonb;
  referral_status text := 'not_provided';
  profile_record public.profiles%rowtype;
begin
  if current_profile_id is null then
    raise exception 'Sessao obrigatoria' using errcode = '42501';
  end if;

  if pg_catalog.char_length(normalized_name) < 5
     or pg_catalog.array_length(pg_catalog.regexp_split_to_array(normalized_name, '\s+'), 1) < 2 then
    raise exception 'Informe nome e sobrenome' using errcode = '22023';
  end if;

  if normalized_phone like '55%' then
    normalized_phone := pg_catalog.substr(normalized_phone, 3);
  end if;
  if pg_catalog.char_length(normalized_phone) not in (10, 11) then
    raise exception 'WhatsApp invalido' using errcode = '22023';
  end if;
  normalized_phone := '+55' || normalized_phone;

  update public.profiles
  set full_name = normalized_name,
      phone_e164 = case
        when target_whatsapp_challenge_id is null then normalized_phone
        else phone_e164
      end,
      updated_at = now()
  where id = current_profile_id
  returning * into profile_record;

  if profile_record.id is null then
    raise exception 'Perfil do cliente ainda nao foi criado' using errcode = 'P0002';
  end if;

  if target_whatsapp_challenge_id is not null then
    claimed_whatsapp := public.customer_claim_verified_whatsapp_registration(
      target_whatsapp_challenge_id
    );
    if coalesce(claimed_whatsapp ->> 'phone_e164', '') <> normalized_phone then
      raise exception 'A validacao do WhatsApp pertence a outro numero' using errcode = '22023';
    end if;
  end if;

  insert into public.consent_events(
    profile_id,
    consent_type,
    granted,
    document_version,
    source
  ) values
    (current_profile_id, 'club_terms', true, '1.0', 'web_simplified_registration_bff'),
    (current_profile_id, 'privacy', true, '1.0', 'web_simplified_registration_bff'),
    (current_profile_id, 'marketing', coalesce(next_marketing, false), '1.0', 'web_simplified_registration_bff');

  insert into public.notification_preferences(
    profile_id,
    flavors,
    festival,
    promotions,
    club_news,
    rewards,
    birthday,
    email_enabled,
    push_enabled,
    whatsapp_enabled
  ) values (
    current_profile_id,
    coalesce(next_marketing, false),
    coalesce(next_marketing, false),
    coalesce(next_marketing, false),
    coalesce(next_marketing, false),
    coalesce(next_marketing, false),
    false,
    false,
    false,
    coalesce(next_marketing, false)
  )
  on conflict (profile_id) do update
  set flavors = excluded.flavors,
      festival = excluded.festival,
      promotions = excluded.promotions,
      club_news = excluded.club_news,
      rewards = excluded.rewards,
      whatsapp_enabled = excluded.whatsapp_enabled,
      updated_at = now();

  if nullif(pg_catalog.btrim(coalesce(target_referral_code, '')), '') is not null then
    begin
      perform public.accept_referral_invite(
        pg_catalog.upper(pg_catalog.btrim(target_referral_code))
      );
      referral_status := 'accepted';
    exception when others then
      referral_status := 'rejected';
    end;
  end if;

  insert into public.audit_events(
    actor_user_id,
    action,
    entity_type,
    entity_id,
    payload
  ) values (
    current_profile_id,
    'customer.registration_completed_bff',
    'profile',
    current_profile_id::text,
    jsonb_build_object(
      'whatsapp_verified', target_whatsapp_challenge_id is not null,
      'marketing_consent', coalesce(next_marketing, false),
      'referral_status', referral_status,
      'source', 'web_simplified_registration_bff'
    )
  );

  select * into profile_record
  from public.profiles
  where id = current_profile_id;

  return jsonb_build_object(
    'completed', true,
    'profile_id', profile_record.id,
    'full_name', profile_record.full_name,
    'phone_e164', profile_record.phone_e164,
    'whatsapp_verified_at', profile_record.whatsapp_verified_at,
    'marketing_consent', coalesce(next_marketing, false),
    'referral_status', referral_status
  );
end;
$$;

revoke all on function public.customer_complete_registration(text,text,boolean,uuid,text)
  from public, anon;
grant execute on function public.customer_complete_registration(text,text,boolean,uuid,text)
  to authenticated;

commit;
