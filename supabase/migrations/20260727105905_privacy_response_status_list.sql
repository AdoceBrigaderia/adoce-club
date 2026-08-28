begin;

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
    select jsonb_agg(
      to_jsonb(request_row)
      order by request_row.overdue desc, request_row.privacy_due_at asc, request_row.created_at desc
    )
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
        feedback.privacy_response_prepared_at,
        feedback.privacy_response_package_version,
        feedback.privacy_response_delivered_at,
        feedback.privacy_response_delivery_channel,
        feedback.privacy_response_delivery_notes,
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

revoke all on function public.staff_list_privacy_requests(text,integer)
  from public, anon;
grant execute on function public.staff_list_privacy_requests(text,integer)
  to authenticated;

commit;
