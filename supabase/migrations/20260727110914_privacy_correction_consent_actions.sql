begin;

alter table public.site_feedback
  add column if not exists privacy_action_applied_at timestamptz,
  add column if not exists privacy_action_applied_by uuid,
  add column if not exists privacy_action_type text,
  add column if not exists privacy_action_summary text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'site_feedback_privacy_action_check'
      and conrelid = 'public.site_feedback'::regclass
  ) then
    alter table public.site_feedback
      add constraint site_feedback_privacy_action_check
      check (
        (
          category = 'privacy'
          and (
            privacy_action_type is null
            or privacy_action_type in ('correction', 'consent')
          )
          and char_length(coalesce(privacy_action_summary, '')) <= 1200
        )
        or
        (
          category <> 'privacy'
          and privacy_action_applied_at is null
          and privacy_action_applied_by is null
          and privacy_action_type is null
          and privacy_action_summary is null
        )
      ) not valid;
  end if;
end;
$$;

alter table public.site_feedback
  validate constraint site_feedback_privacy_action_check;

create index if not exists site_feedback_privacy_action_pending_idx
  on public.site_feedback (privacy_request_type, privacy_due_at, created_at)
  where category = 'privacy'
    and privacy_request_type in ('correction', 'consent')
    and privacy_action_applied_at is null
    and status not in ('resolved', 'closed');

create or replace function public.staff_apply_privacy_name_correction(
  target_feedback_id uuid,
  requested_full_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  request_row public.site_feedback%rowtype;
  profile_row public.profiles%rowtype;
  normalized_name text := private.normalize_person_name(requested_full_name);
  previous_name text;
begin
  if actor_user_id is null
     or not private.staff_has_any_capability('manage_customers') then
    raise exception 'Acesso à correção de dados não autorizado';
  end if;

  if char_length(normalized_name) < 5
     or array_length(regexp_split_to_array(normalized_name, '\s+'), 1) < 2 then
    raise exception 'Informe nome e sobrenome válidos';
  end if;

  select feedback.*
  into request_row
  from public.site_feedback feedback
  where feedback.id = target_feedback_id
    and feedback.category = 'privacy'
  for update;

  if request_row.id is null then
    raise exception 'Solicitação de privacidade não encontrada';
  end if;
  if request_row.privacy_request_type <> 'correction' then
    raise exception 'Esta ação é exclusiva para solicitação de correção de dados';
  end if;
  if coalesce(request_row.privacy_identity_status, 'pending') <> 'verified' then
    raise exception 'Confirme a identidade antes de corrigir o cadastro';
  end if;
  if request_row.profile_id is null then
    raise exception 'Vincule a solicitação ao cadastro correto';
  end if;

  select profile.*
  into profile_row
  from public.profiles profile
  where profile.id = request_row.profile_id
  for update;

  if profile_row.id is null then
    raise exception 'Cadastro vinculado não encontrado';
  end if;

  previous_name := profile_row.full_name;

  update public.profiles
  set full_name = normalized_name,
      updated_at = now()
  where id = profile_row.id;

  update public.site_feedback
  set privacy_action_applied_at = now(),
      privacy_action_applied_by = actor_user_id,
      privacy_action_type = 'correction',
      privacy_action_summary = 'Nome do cadastro corrigido após confirmação de identidade.',
      status = 'resolved',
      privacy_resolved_at = coalesce(privacy_resolved_at, now()),
      updated_at = now()
  where id = request_row.id;

  insert into public.audit_events(
    actor_user_id,
    action,
    entity_type,
    entity_id,
    payload
  ) values (
    actor_user_id,
    'privacy_request.profile_name_corrected',
    'profile',
    profile_row.id::text,
    jsonb_build_object(
      'feedback_id', request_row.id,
      'protocol', request_row.protocol,
      'previous_name', previous_name,
      'next_name', normalized_name
    )
  );

  return jsonb_build_object(
    'id', request_row.id,
    'protocol', request_row.protocol,
    'profile_id', profile_row.id,
    'previous_full_name', previous_name,
    'full_name', normalized_name,
    'privacy_action_type', 'correction',
    'privacy_action_applied_at', now(),
    'status', 'resolved'
  );
end;
$$;

create or replace function public.staff_apply_privacy_consent_change(
  target_feedback_id uuid,
  requested_marketing boolean,
  requested_whatsapp boolean default false,
  requested_email boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  request_row public.site_feedback%rowtype;
  profile_row public.profiles%rowtype;
  allow_marketing boolean := coalesce(requested_marketing, false);
  allow_whatsapp boolean := coalesce(requested_marketing, false) and coalesce(requested_whatsapp, false);
  allow_email boolean := coalesce(requested_marketing, false) and coalesce(requested_email, false);
begin
  if actor_user_id is null
     or not private.staff_has_any_capability('manage_customers') then
    raise exception 'Acesso à alteração de consentimento não autorizado';
  end if;

  select feedback.*
  into request_row
  from public.site_feedback feedback
  where feedback.id = target_feedback_id
    and feedback.category = 'privacy'
  for update;

  if request_row.id is null then
    raise exception 'Solicitação de privacidade não encontrada';
  end if;
  if request_row.privacy_request_type <> 'consent' then
    raise exception 'Esta ação é exclusiva para alteração de consentimento';
  end if;
  if coalesce(request_row.privacy_identity_status, 'pending') <> 'verified' then
    raise exception 'Confirme a identidade antes de alterar consentimentos';
  end if;
  if request_row.profile_id is null then
    raise exception 'Vincule a solicitação ao cadastro correto';
  end if;

  select profile.*
  into profile_row
  from public.profiles profile
  where profile.id = request_row.profile_id
  for share;

  if profile_row.id is null then
    raise exception 'Cadastro vinculado não encontrado';
  end if;

  insert into public.consent_events(
    profile_id,
    consent_type,
    granted,
    document_version,
    source
  ) values (
    profile_row.id,
    'marketing',
    allow_marketing,
    '1.0',
    'privacy_request_staff'
  );

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
    profile_row.id,
    allow_marketing,
    allow_marketing,
    allow_marketing,
    allow_marketing,
    allow_marketing,
    false,
    allow_email,
    false,
    allow_whatsapp
  )
  on conflict (profile_id) do update
  set flavors = excluded.flavors,
      festival = excluded.festival,
      promotions = excluded.promotions,
      club_news = excluded.club_news,
      rewards = excluded.rewards,
      email_enabled = excluded.email_enabled,
      whatsapp_enabled = excluded.whatsapp_enabled,
      updated_at = now();

  update public.site_feedback
  set privacy_action_applied_at = now(),
      privacy_action_applied_by = actor_user_id,
      privacy_action_type = 'consent',
      privacy_action_summary = case
        when allow_marketing then 'Consentimento de marketing atualizado com canais autorizados.'
        else 'Consentimento de marketing revogado e canais promocionais desativados.'
      end,
      status = 'resolved',
      privacy_resolved_at = coalesce(privacy_resolved_at, now()),
      updated_at = now()
  where id = request_row.id;

  insert into public.audit_events(
    actor_user_id,
    action,
    entity_type,
    entity_id,
    payload
  ) values (
    actor_user_id,
    'privacy_request.marketing_consent_changed',
    'profile',
    profile_row.id::text,
    jsonb_build_object(
      'feedback_id', request_row.id,
      'protocol', request_row.protocol,
      'marketing', allow_marketing,
      'whatsapp', allow_whatsapp,
      'email', allow_email,
      'source', 'privacy_request_staff'
    )
  );

  return jsonb_build_object(
    'id', request_row.id,
    'protocol', request_row.protocol,
    'profile_id', profile_row.id,
    'marketing', allow_marketing,
    'whatsapp', allow_whatsapp,
    'email', allow_email,
    'privacy_action_type', 'consent',
    'privacy_action_applied_at', now(),
    'status', 'resolved'
  );
end;
$$;

revoke all on function public.staff_apply_privacy_name_correction(uuid,text)
  from public, anon;
grant execute on function public.staff_apply_privacy_name_correction(uuid,text)
  to authenticated;

revoke all on function public.staff_apply_privacy_consent_change(uuid,boolean,boolean,boolean)
  from public, anon;
grant execute on function public.staff_apply_privacy_consent_change(uuid,boolean,boolean,boolean)
  to authenticated;

commit;
