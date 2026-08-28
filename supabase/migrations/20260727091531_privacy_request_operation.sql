begin;

create index if not exists site_feedback_privacy_status_created_idx
  on public.site_feedback (status, created_at desc)
  where category = 'privacy';

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
    select jsonb_agg(to_jsonb(request_row) order by request_row.created_at desc)
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
        feedback.created_at,
        feedback.updated_at
      from public.site_feedback feedback
      where feedback.category = 'privacy'
        and (
          requested_status is null
          or feedback.status = requested_status
        )
      order by
        case feedback.status
          when 'new' then 1
          when 'reviewing' then 2
          when 'resolved' then 3
          else 4
        end,
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

  update public.site_feedback
  set status = requested_status,
      internal_notes = btrim(coalesce(requested_internal_notes, '')),
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
      'previous_status', previous_row.status,
      'next_status', updated_row.status,
      'notes_changed', previous_row.internal_notes is distinct from updated_row.internal_notes
    )
  );

  return jsonb_build_object(
    'id', updated_row.id,
    'protocol', updated_row.protocol,
    'status', updated_row.status,
    'internal_notes', updated_row.internal_notes,
    'updated_at', updated_row.updated_at
  );
end;
$$;

revoke all on function public.staff_list_privacy_requests(text,integer)
  from public, anon;
grant execute on function public.staff_list_privacy_requests(text,integer)
  to authenticated;

revoke all on function public.staff_update_privacy_request(uuid,text,text)
  from public, anon;
grant execute on function public.staff_update_privacy_request(uuid,text,text)
  to authenticated;

commit;
