begin;

do $$
declare
  actor_id uuid;
  target_profile_id uuid;
  access_id uuid;
  correction_id uuid;
  deletion_id uuid;
  access_blocked boolean := false;
  correction_blocked boolean := false;
  deletion_blocked boolean := false;
begin
  select member.user_id
  into actor_id
  from public.staff_members member
  where member.active
    and member.role::text in ('owner', 'manager')
  order by case member.role::text when 'owner' then 1 else 2 end
  limit 1;

  select profile.id
  into target_profile_id
  from public.profiles profile
  where coalesce(profile.active, true)
  order by profile.created_at
  limit 1;

  if actor_id is null or target_profile_id is null then
    raise exception 'Homologação precisa de gestor e cadastro ativos para o ensaio';
  end if;

  insert into public.site_feedback(
    protocol, public_request_key, profile_id, category, customer_name,
    page_url, message, privacy_request_type, privacy_due_at,
    privacy_identity_status, privacy_identity_checked_at,
    privacy_identity_checked_by, privacy_identity_notes
  )
  select
    'PRIV-GUARD-A-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
    gen_random_uuid(), profile.id, 'privacy', profile.full_name,
    'https://homologacao-adoce--adoce-homologacao.netlify.app/#operacao',
    'Teste temporário do guard de consulta.', 'access', now() + interval '15 days',
    'verified', now(), actor_id, 'Identidade confirmada no ensaio.'
  from public.profiles profile where profile.id = target_profile_id
  returning id into access_id;

  insert into public.site_feedback(
    protocol, public_request_key, profile_id, category, customer_name,
    page_url, message, privacy_request_type, privacy_due_at,
    privacy_identity_status, privacy_identity_checked_at,
    privacy_identity_checked_by, privacy_identity_notes
  )
  select
    'PRIV-GUARD-C-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
    gen_random_uuid(), profile.id, 'privacy', profile.full_name,
    'https://homologacao-adoce--adoce-homologacao.netlify.app/#operacao',
    'Teste temporário do guard de correção.', 'correction', now() + interval '15 days',
    'verified', now(), actor_id, 'Identidade confirmada no ensaio.'
  from public.profiles profile where profile.id = target_profile_id
  returning id into correction_id;

  insert into public.site_feedback(
    protocol, public_request_key, profile_id, category, customer_name,
    page_url, message, privacy_request_type, privacy_due_at,
    privacy_identity_status, privacy_identity_checked_at,
    privacy_identity_checked_by, privacy_identity_notes
  )
  select
    'PRIV-GUARD-D-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
    gen_random_uuid(), profile.id, 'privacy', profile.full_name,
    'https://homologacao-adoce--adoce-homologacao.netlify.app/#operacao',
    'Teste temporário do guard de exclusão.', 'deletion', now() + interval '15 days',
    'verified', now(), actor_id, 'Identidade confirmada no ensaio.'
  from public.profiles profile where profile.id = target_profile_id
  returning id into deletion_id;

  perform set_config('request.jwt.claim.sub', actor_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', actor_id, 'role', 'authenticated')::text,
    true
  );

  perform public.staff_prepare_privacy_access_response(access_id);

  begin
    perform public.staff_update_privacy_request(
      access_id,
      'resolved',
      'Tentativa antes da entrega.'
    );
  exception when others then
    access_blocked := position('Registre a entrega do pacote' in sqlerrm) > 0;
  end;

  begin
    perform public.staff_update_privacy_request(
      correction_id,
      'resolved',
      'Tentativa antes da correção.'
    );
  exception when others then
    correction_blocked := position('Execute a alteração solicitada' in sqlerrm) > 0;
  end;

  begin
    perform public.staff_update_privacy_request(
      deletion_id,
      'resolved',
      'Tentativa sem procedimento protegido.'
    );
  exception when others then
    deletion_blocked := position('procedimento protegido específico' in sqlerrm) > 0;
  end;

  if not access_blocked or not correction_blocked or not deletion_blocked then
    raise exception 'Guard de resultado específico não bloqueou todos os fluxos';
  end if;
end;
$$;

rollback;
