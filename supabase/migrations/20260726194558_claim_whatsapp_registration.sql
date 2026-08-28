begin;

create or replace function public.customer_claim_verified_whatsapp_registration(
  challenge_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_profile_id uuid := (select auth.uid());
  challenge public.whatsapp_auth_challenges%rowtype;
  conflicting_profile_id uuid;
begin
  if current_profile_id is null then
    raise exception 'Sessao obrigatoria' using errcode = '42501';
  end if;

  select * into challenge
  from public.whatsapp_auth_challenges row_to_lock
  where row_to_lock.id = customer_claim_verified_whatsapp_registration.challenge_id
  for update;

  if challenge.id is null
     or challenge.status <> 'verified'
     or challenge.purpose <> 'registration'
     or challenge.verified_at is null
     or challenge.verified_at < now() - interval '20 minutes' then
    raise exception 'Validacao do WhatsApp invalida ou expirada' using errcode = '22023';
  end if;

  if challenge.profile_id is not null and challenge.profile_id <> current_profile_id then
    raise exception 'Esta validacao ja foi utilizada' using errcode = '23505';
  end if;

  select profile.id into conflicting_profile_id
  from public.profiles profile
  where profile.phone_e164 = challenge.phone_e164
    and profile.id <> current_profile_id
  limit 1;

  if conflicting_profile_id is not null then
    raise exception 'Este WhatsApp ja esta vinculado a outro cadastro' using errcode = '23505';
  end if;

  update public.profiles
  set phone_e164 = challenge.phone_e164,
      whatsapp_verified_at = coalesce(whatsapp_verified_at, challenge.verified_at, now()),
      updated_at = now()
  where id = current_profile_id;

  if not found then
    raise exception 'Perfil do cliente ainda nao foi criado' using errcode = 'P0002';
  end if;

  update public.whatsapp_auth_challenges
  set profile_id = current_profile_id,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'claimed_at', now(),
        'claimed_by', current_profile_id
      )
  where id = challenge.id;

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values (
    current_profile_id,
    'security.whatsapp_registration_claimed',
    'whatsapp_auth_challenge',
    challenge.id::text,
    jsonb_build_object(
      'phone_hash', challenge.phone_hash,
      'verified_at', challenge.verified_at
    )
  );

  return jsonb_build_object(
    'claimed', true,
    'profile_id', current_profile_id,
    'phone_e164', challenge.phone_e164,
    'whatsapp_verified_at', coalesce(challenge.verified_at, now())
  );
end;
$$;

revoke all on function public.customer_claim_verified_whatsapp_registration(uuid)
  from public, anon;
grant execute on function public.customer_claim_verified_whatsapp_registration(uuid)
  to authenticated;

commit;
