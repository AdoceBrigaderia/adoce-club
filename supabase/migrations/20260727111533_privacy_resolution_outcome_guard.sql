begin;

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

  if requested_status = 'resolved'
     and previous_row.privacy_request_type = 'access'
     and previous_row.privacy_response_delivered_at is null then
    raise exception 'Registre a entrega do pacote de dados antes de resolver a consulta';
  end if;

  if requested_status = 'resolved'
     and previous_row.privacy_request_type in ('correction', 'consent')
     and previous_row.privacy_action_applied_at is null then
    raise exception 'Execute a alteração solicitada antes de marcar o pedido como resolvido';
  end if;

  if requested_status = 'resolved'
     and previous_row.privacy_request_type = 'deletion' then
    raise exception 'A exclusão ou anonimização exige o procedimento protegido específico';
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
      'privacy_response_delivered_at', updated_row.privacy_response_delivered_at,
      'privacy_action_applied_at', updated_row.privacy_action_applied_at,
      'privacy_action_type', updated_row.privacy_action_type,
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
    'privacy_response_delivered_at', updated_row.privacy_response_delivered_at,
    'privacy_action_applied_at', updated_row.privacy_action_applied_at,
    'privacy_action_type', updated_row.privacy_action_type,
    'updated_at', updated_row.updated_at
  );
end;
$$;

revoke all on function public.staff_update_privacy_request(uuid,text,text)
  from public, anon;
grant execute on function public.staff_update_privacy_request(uuid,text,text)
  to authenticated;

commit;
