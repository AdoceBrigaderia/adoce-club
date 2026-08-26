begin;

alter table public.site_feedback
  add column if not exists privacy_deletion_reviewed_at timestamptz,
  add column if not exists privacy_deletion_reviewed_by uuid,
  add column if not exists privacy_deletion_ready boolean,
  add column if not exists privacy_deletion_blockers jsonb;

alter table public.site_feedback
  drop constraint if exists site_feedback_privacy_action_check;

alter table public.site_feedback
  add constraint site_feedback_privacy_action_check
  check (
    (
      category = 'privacy'
      and (
        privacy_action_type is null
        or privacy_action_type in ('correction', 'consent', 'deletion_review')
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

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'site_feedback_privacy_deletion_review_check'
      and conrelid = 'public.site_feedback'::regclass
  ) then
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
              and jsonb_typeof(coalesce(privacy_deletion_blockers, '[]'::jsonb)) = 'array'
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
  end if;
end;
$$;

alter table public.site_feedback
  validate constraint site_feedback_privacy_deletion_review_check;

create index if not exists site_feedback_privacy_deletion_review_idx
  on public.site_feedback (privacy_deletion_ready, privacy_due_at, created_at)
  where category = 'privacy'
    and privacy_request_type = 'deletion'
    and status not in ('resolved', 'closed');

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
  profile_row public.profiles%rowtype;
  active_staff_count integer := 0;
  pending_order_count integer := 0;
  pending_checkin_count integer := 0;
  available_reward_count integer := 0;
  loyalty_progress integer := 0;
  active_membership_count integer := 0;
  blockers jsonb := '[]'::jsonb;
  ready boolean := false;
begin
  if actor_user_id is null
     or not private.staff_has_any_capability('manage_customers') then
    raise exception 'Acesso à revisão de anonimização não autorizado';
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
  if request_row.privacy_request_type <> 'deletion' then
    raise exception 'Esta revisão é exclusiva para exclusão ou anonimização';
  end if;
  if coalesce(request_row.privacy_identity_status, 'pending') <> 'verified' then
    raise exception 'Confirme a identidade antes de revisar a anonimização';
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

  select count(*)::integer
  into active_staff_count
  from public.staff_members member
  where member.user_id = profile_row.id
    and member.active;

  select count(*)::integer
  into pending_order_count
  from public.instant_orders customer_order
  where customer_order.profile_id = profile_row.id
    and (
      coalesce(customer_order.status::text, '') in (
        'new', 'pending', 'confirmed', 'preparing', 'ready'
      )
      or coalesce(customer_order.payment_status::text, '') in (
        'pending', 'processing', 'authorized'
      )
    );

  select count(*)::integer
  into pending_checkin_count
  from public.customer_checkins checkin
  where checkin.profile_id = profile_row.id
    and checkin.status = 'pending'
    and checkin.expires_at > now();

  select
    count(*)::integer,
    coalesce(sum(track.current_progress), 0)::integer
  into active_membership_count, loyalty_progress
  from public.account_memberships membership
  join public.loyalty_tracks track
    on track.account_id = membership.account_id
   and track.kind::text = 'main'
  where membership.profile_id = profile_row.id
    and membership.active;

  select count(*)::integer
  into available_reward_count
  from public.account_memberships membership
  join public.loyalty_tracks track
    on track.account_id = membership.account_id
  join public.rewards reward
    on reward.track_id = track.id
   and reward.status::text = 'available'
  where membership.profile_id = profile_row.id
    and membership.active;

  if active_staff_count > 0 then
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'active_staff_access',
      'label', 'O cadastro também pertence à equipe ativa.',
      'count', active_staff_count
    ));
  end if;

  if pending_order_count > 0 then
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'pending_orders',
      'label', 'Existem pedidos ou pagamentos ainda em andamento.',
      'count', pending_order_count
    ));
  end if;

  if pending_checkin_count > 0 then
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'pending_checkins',
      'label', 'Existe check-in temporário ainda ativo.',
      'count', pending_checkin_count
    ));
  end if;

  if available_reward_count > 0 or loyalty_progress > 0 then
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'code', 'loyalty_value',
      'label', 'Há carimbos ou recompensas que precisam de destinação registrada.',
      'available_rewards', available_reward_count,
      'current_progress', loyalty_progress
    ));
  end if;

  ready := jsonb_array_length(blockers) = 0;

  update public.site_feedback
  set privacy_deletion_reviewed_at = now(),
      privacy_deletion_reviewed_by = actor_user_id,
      privacy_deletion_ready = ready,
      privacy_deletion_blockers = blockers,
      privacy_action_type = 'deletion_review',
      privacy_action_summary = case
        when ready then 'Revisão concluída sem bloqueadores operacionais. A anonimização final continua exigindo confirmação protegida.'
        else 'Revisão concluída com bloqueadores operacionais pendentes.'
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
      'profile_id', profile_row.id,
      'ready', ready,
      'blockers', blockers,
      'active_staff_count', active_staff_count,
      'pending_order_count', pending_order_count,
      'pending_checkin_count', pending_checkin_count,
      'available_reward_count', available_reward_count,
      'loyalty_progress', loyalty_progress,
      'active_membership_count', active_membership_count
    )
  );

  return jsonb_build_object(
    'id', request_row.id,
    'protocol', request_row.protocol,
    'profile_id', profile_row.id,
    'ready', ready,
    'blockers', blockers,
    'summary', jsonb_build_object(
      'active_staff_count', active_staff_count,
      'pending_order_count', pending_order_count,
      'pending_checkin_count', pending_checkin_count,
      'available_reward_count', available_reward_count,
      'loyalty_progress', loyalty_progress,
      'active_membership_count', active_membership_count
    ),
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
