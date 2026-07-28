begin;

alter table public.site_feedback
  add column if not exists privacy_identity_status text,
  add column if not exists privacy_identity_checked_at timestamptz,
  add column if not exists privacy_identity_checked_by uuid,
  add column if not exists privacy_identity_notes text;

update public.site_feedback
set privacy_identity_status = coalesce(privacy_identity_status, 'pending')
where category = 'privacy';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'site_feedback_privacy_identity_check'
      and conrelid = 'public.site_feedback'::regclass
  ) then
    alter table public.site_feedback
      add constraint site_feedback_privacy_identity_check
      check (
        (
          category = 'privacy'
          and privacy_identity_status in ('pending', 'verified', 'rejected')
          and char_length(coalesce(privacy_identity_notes, '')) <= 1200
        )
        or
        (
          category <> 'privacy'
          and privacy_identity_status is null
          and privacy_identity_checked_at is null
          and privacy_identity_checked_by is null
          and privacy_identity_notes is null
        )
      ) not valid;
  end if;
end;
$$;

alter table public.site_feedback
  validate constraint site_feedback_privacy_identity_check;

create index if not exists site_feedback_privacy_identity_pending_idx
  on public.site_feedback (privacy_identity_status, privacy_due_at, created_at)
  where category = 'privacy'
    and status not in ('resolved', 'closed');

create or replace function public.staff_verify_privacy_request_identity(
  target_feedback_id uuid,
  requested_identity_status text,
  requested_verification_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  previous_row public.site_feedback%rowtype;
  updated_row public.site_feedback%rowtype;
  normalized_status text := lower(btrim(coalesce(requested_identity_status, '')));
  normalized_notes text := btrim(coalesce(requested_verification_notes, ''));
begin
  if actor_user_id is null
     or not private.staff_has_any_capability('manage_customers') then
    raise exception 'Acesso à verificação de identidade não autorizado';
  end if;

  if target_feedback_id is null then
    raise exception 'Selecione uma solicitação de privacidade';
  end if;
  if normalized_status not in ('pending', 'verified', 'rejected') then
    raise exception 'Situação de identidade inválida';
  end if;
  if char_length(normalized_notes) > 1200 then
    raise exception 'A anotação da verificação deve ter no máximo 1200 caracteres';
  end if;
  if normalized_status in ('verified', 'rejected')
     and char_length(normalized_notes) < 5 then
    raise exception 'Registre como a identidade foi verificada ou por que não foi confirmada';
  end if;

  select feedback.*
  into previous_row
  from public.site_feedback feedback
  where feedback.id = target_feedback_id
    and feedback.category = 'privacy'
  for update;

  if previous_row.id is null then
    raise exception 'Solicitação de privacidade não encontrada';
  end if;

  update public.site_feedback
  set privacy_identity_status = normalized_status,
      privacy_identity_checked_at = case
        when normalized_status in ('verified', 'rejected') then now()
        else null
      end,
      privacy_identity_checked_by = case
        when normalized_status in ('verified', 'rejected') then actor_user_id
        else null
      end,
      privacy_identity_notes = nullif(normalized_notes, ''),
      updated_at = now()
  where id = target_feedback_id
  returning * into updated_row;

  insert into public.audit_events(
    actor_user_id,
    action,
    entity_type,
    entity_id,
    payload
  ) values (
    actor_user_id,
    'privacy_request.identity_checked',
    'site_feedback',
    target_feedback_id::text,
    jsonb_build_object(
      'protocol', updated_row.protocol,
      'previous_identity_status', previous_row.privacy_identity_status,
      'next_identity_status', updated_row.privacy_identity_status,
      'notes_changed', previous_row.privacy_identity_notes is distinct from updated_row.privacy_identity_notes,
      'checked_at', updated_row.privacy_identity_checked_at
    )
  );

  return jsonb_build_object(
    'id', updated_row.id,
    'protocol', updated_row.protocol,
    'privacy_identity_status', updated_row.privacy_identity_status,
    'privacy_identity_checked_at', updated_row.privacy_identity_checked_at,
    'privacy_identity_notes', updated_row.privacy_identity_notes,
    'updated_at', updated_row.updated_at
  );
end;
$$;

create or replace function public.staff_list_privacy_requests(
  requested_status text default null,
  requested_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_limit integer := least(greatest(coalesce(requested_limit, 50), 1), 100);
begin
  if (select auth.uid()) is null
     or not private.staff_has_any_capability('manage_customers') then
    raise exception 'Acesso às solicitações de privacidade não autorizado';
  end if;

  if requested_status is not null
     and requested_status not in ('new', 'reviewing', 'resolved', 'closed') then
    raise exception 'Status de privacidade inválido';
  end if;

  return coalesce((
    select jsonb_agg(to_jsonb(request_row) order by request_row.overdue desc, request_row.privacy_due_at asc, request_row.created_at desc)
    from (
      select
        feedback.id,
        feedback.protocol,
        feedback.profile_id,
        feedback.customer_name,
        feedback.customer_email,
        feedback.customer_phone,
        feedback.message,
        feedback.status,
        feedback.internal_notes,
        feedback.privacy_request_type,
        feedback.privacy_due_at,
        feedback.privacy_resolved_at,
        feedback.privacy_closed_at,
        feedback.privacy_identity_status,
        feedback.privacy_identity_checked_at,
        feedback.privacy_identity_notes,
        feedback.created_at,
        feedback.updated_at,
        (
          feedback.privacy_due_at < now()
          and feedback.status not in ('resolved', 'closed')
        ) as overdue
      from public.site_feedback feedback
      where feedback.category = 'privacy'
        and (
          requested_status is null
          or feedback.status = requested_status
        )
      order by
        (
          feedback.privacy_due_at < now()
          and feedback.status not in ('resolved', 'closed')
        ) desc,
        case feedback.status
          when 'new' then 1
          when 'reviewing' then 2
          when 'resolved' then 3
          else 4
        end,
        feedback.privacy_due_at asc,
        feedback.created_at desc
      limit safe_limit
    ) request_row
  ), '[]'::jsonb);
end;
$$;

create or replace function public.staff_update_privacy_request(
  target_feedback_id uuid,
  requested_status text,
  requested_internal_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  previous_row public.site_feedback%rowtype;
  updated_row public.site_feedback%rowtype;
begin
  if actor_user_id is null
     or not private.staff_has_any_capability('manage_customers') then
    raise exception 'Acesso às solicitações de privacidade não autorizado';
  end if;

  if target_feedback_id is null then
    raise exception 'Selecione uma solicitação de privacidade';
  end if;
  if requested_status not in ('new', 'reviewing', 'resolved', 'closed') then
    raise exception 'Status de privacidade inválido';
  end if;
  if char_length(coalesce(requested_internal_notes, '')) > 3000 then
    raise exception 'A anotação interna deve ter no máximo 3000 caracteres';
  end if;

  select feedback.*
  into previous_row
  from public.site_feedback feedback
  where feedback.id = target_feedback_id
    and feedback.category = 'privacy'
  for update;

  if previous_row.id is null then
    raise exception 'Solicitação de privacidade não encontrada';
  end if;

  if requested_status = 'resolved'
     and previous_row.privacy_request_type in ('access', 'correction', 'deletion', 'consent')
     and coalesce(previous_row.privacy_identity_status, 'pending') <> 'verified' then
    raise exception 'Confirme a identidade do solicitante antes de marcar este pedido como resolvido';
  end if;

  update public.site_feedback
  set status = requested_status,
      internal_notes = btrim(coalesce(requested_internal_notes, '')),
      privacy_resolved_at = case
        when requested_status = 'resolved' then coalesce(previous_row.privacy_resolved_at, now())
        when requested_status in ('new', 'reviewing') then null
        else previous_row.privacy_resolved_at
      end,
      privacy_closed_at = case
        when requested_status = 'closed' then coalesce(previous_row.privacy_closed_at, now())
        else null
      end,
      updated_at = now()
  where id = target_feedback_id
  returning * into updated_row;

  insert into public.audit_events(
    actor_user_id,
    action,
    entity_type,
    entity_id,
    payload
  ) values (
    actor_user_id,
    'privacy_request.updated',
    'site_feedback',
    target_feedback_id::text,
    jsonb_build_object(
      'protocol', updated_row.protocol,
      'privacy_request_type', updated_row.privacy_request_type,
      'privacy_due_at', updated_row.privacy_due_at,
      'privacy_identity_status', updated_row.privacy_identity_status,
      'previous_status', previous_row.status,
      'next_status', updated_row.status,
      'was_overdue', previous_row.privacy_due_at < now() and previous_row.status not in ('resolved', 'closed'),
      'notes_changed', previous_row.internal_notes is distinct from updated_row.internal_notes,
      'resolved_at', updated_row.privacy_resolved_at,
      'closed_at', updated_row.privacy_closed_at
    )
  );

  return jsonb_build_object(
    'id', updated_row.id,
    'protocol', updated_row.protocol,
    'status', updated_row.status,
    'internal_notes', updated_row.internal_notes,
    'privacy_request_type', updated_row.privacy_request_type,
    'privacy_due_at', updated_row.privacy_due_at,
    'privacy_resolved_at', updated_row.privacy_resolved_at,
    'privacy_closed_at', updated_row.privacy_closed_at,
    'privacy_identity_status', updated_row.privacy_identity_status,
    'updated_at', updated_row.updated_at
  );
end;
$$;

revoke all on function public.staff_verify_privacy_request_identity(uuid,text,text)
  from public, anon;
grant execute on function public.staff_verify_privacy_request_identity(uuid,text,text)
  to authenticated;

revoke all on function public.staff_list_privacy_requests(text,integer)
  from public, anon;
grant execute on function public.staff_list_privacy_requests(text,integer)
  to authenticated;

revoke all on function public.staff_update_privacy_request(uuid,text,text)
  from public, anon;
grant execute on function public.staff_update_privacy_request(uuid,text,text)
  to authenticated;

commit;
