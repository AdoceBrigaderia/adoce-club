begin;

alter table public.site_feedback
  drop constraint if exists site_feedback_privacy_action_check;

alter table public.site_feedback
  add constraint site_feedback_privacy_action_check
  check (
    (
      category = 'privacy'
      and (
        privacy_action_type is null
        or privacy_action_type in ('correction', 'consent', 'deletion_review', 'deletion')
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

alter table public.site_feedback
  validate constraint site_feedback_privacy_action_check;

alter table public.site_feedback
  drop constraint if exists site_feedback_privacy_deletion_review_check;

alter table public.site_feedback
  add constraint site_feedback_privacy_deletion_review_check
  check (
    (
      category = 'privacy'
      and privacy_request_type = 'deletion'
      and (
        privacy_deletion_reviewed_at is null
        or (
          privacy_deletion_reviewed_by is not null
          and privacy_deletion_ready is not null
          and jsonb_typeof(coalesce(privacy_deletion_blockers, '{}'::jsonb)) in ('object', 'array')
        )
      )
    )
    or
    (
      category <> 'privacy'
      or privacy_request_type <> 'deletion'
    )
    and privacy_deletion_reviewed_at is null
    and privacy_deletion_reviewed_by is null
    and privacy_deletion_ready is null
    and privacy_deletion_blockers is null
  ) not valid;

alter table public.site_feedback
  validate constraint site_feedback_privacy_deletion_review_check;

create or replace function public.staff_review_privacy_anonymization(
  target_feedback_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  request_row public.site_feedback%rowtype;
  plan jsonb;
  ready boolean := false;
  blockers jsonb := '{}'::jsonb;
begin
  if actor_user_id is null or private.current_staff_role()::text <> 'owner' then
    raise exception 'Somente o proprietário pode revisar exclusão ou anonimização';
  end if;

  select feedback.*
  into request_row
  from public.site_feedback feedback
  where feedback.id = target_feedback_id
    and feedback.category = 'privacy'
  for update;

  if request_row.id is null or request_row.privacy_request_type <> 'deletion' then
    raise exception 'Solicitação de exclusão ou anonimização não encontrada';
  end if;
  if coalesce(request_row.privacy_identity_status, 'pending') <> 'verified' then
    raise exception 'Confirme a identidade antes de revisar a anonimização';
  end if;
  if request_row.profile_id is null then
    raise exception 'Vincule a solicitação ao cadastro correto';
  end if;

  plan := public.staff_get_privacy_anonymization_plan(target_feedback_id);
  ready := coalesce((plan->>'ready')::boolean, false);
  blockers := coalesce(plan->'blockers', '{}'::jsonb);

  update public.site_feedback
  set privacy_deletion_reviewed_at = now(),
      privacy_deletion_reviewed_by = actor_user_id,
      privacy_deletion_ready = ready,
      privacy_deletion_blockers = blockers,
      privacy_action_type = 'deletion_review',
      privacy_action_summary = case
        when ready then 'Plano de anonimização revisado e pronto para confirmação protegida do proprietário.'
        else 'Plano de anonimização revisado com bloqueadores operacionais pendentes.'
      end,
      status = 'reviewing',
      privacy_resolved_at = null,
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
    'privacy_request.anonymization_reviewed',
    'site_feedback',
    request_row.id::text,
    jsonb_build_object(
      'protocol', request_row.protocol,
      'profile_id', request_row.profile_id,
      'ready', ready,
      'plan', plan
    )
  );

  return plan || jsonb_build_object(
    'reviewed_at', now(),
    'status', 'reviewing'
  );
end;
$$;

revoke all on function public.staff_review_privacy_anonymization(uuid)
  from public, anon;
grant execute on function public.staff_review_privacy_anonymization(uuid)
  to authenticated;

commit;
