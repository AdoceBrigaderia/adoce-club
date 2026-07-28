begin;

alter table public.site_feedback
  add column if not exists privacy_request_type text,
  add column if not exists privacy_due_at timestamptz,
  add column if not exists privacy_resolved_at timestamptz,
  add column if not exists privacy_closed_at timestamptz;

update public.site_feedback
set privacy_request_type = coalesce(privacy_request_type, 'other'),
    privacy_due_at = coalesce(privacy_due_at, created_at + interval '15 days')
where category = 'privacy';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'site_feedback_privacy_workflow_check'
      and conrelid = 'public.site_feedback'::regclass
  ) then
    alter table public.site_feedback
      add constraint site_feedback_privacy_workflow_check
      check (
        (
          category = 'privacy'
          and privacy_request_type in ('access', 'correction', 'deletion', 'consent', 'other')
          and privacy_due_at is not null
        )
        or
        (
          category <> 'privacy'
          and privacy_request_type is null
          and privacy_due_at is null
          and privacy_resolved_at is null
          and privacy_closed_at is null
        )
      ) not valid;
  end if;
end;
$$;

alter table public.site_feedback
  validate constraint site_feedback_privacy_workflow_check;

create index if not exists site_feedback_privacy_due_idx
  on public.site_feedback (privacy_due_at, status, created_at)
  where category = 'privacy' and status not in ('resolved', 'closed');

create or replace function public.submit_site_feedback_bff(
  requested_operation_key uuid,
  requested_profile_id uuid,
  requested_category text,
  requested_customer_name text,
  requested_customer_email text,
  requested_customer_phone text,
  requested_page_url text,
  requested_message text,
  requested_privacy_type text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_feedback public.site_feedback%rowtype;
  created_feedback public.site_feedback%rowtype;
  linked_profile_id uuid;
  normalized_privacy_type text := nullif(lower(btrim(coalesce(requested_privacy_type, ''))), '');
begin
  if requested_operation_key is null then
    raise exception 'Chave da mensagem é obrigatória';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('site-feedback:' || requested_operation_key::text, 0)
  );

  select feedback.*
  into existing_feedback
  from public.site_feedback feedback
  where feedback.public_request_key = requested_operation_key
  limit 1;

  if existing_feedback.id is not null then
    return jsonb_build_object(
      'protocol', existing_feedback.protocol,
      'idempotent', true
    );
  end if;

  if requested_category not in (
    'problem',
    'complaint',
    'suggestion',
    'compliment',
    'privacy'
  ) then
    raise exception 'Tipo de mensagem inválido';
  end if;
  if char_length(btrim(coalesce(requested_customer_name, ''))) < 2 then
    raise exception 'Informe seu nome';
  end if;
  if char_length(btrim(coalesce(requested_message, ''))) < 10 then
    raise exception 'Conte um pouco mais sobre o que aconteceu';
  end if;
  if nullif(btrim(coalesce(requested_customer_email, '')), '') is not null
     and btrim(requested_customer_email) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Informe um e-mail válido';
  end if;

  if requested_category = 'privacy' then
    if nullif(btrim(coalesce(requested_customer_email, '')), '') is null
       and nullif(btrim(coalesce(requested_customer_phone, '')), '') is null then
      raise exception 'Informe um e-mail ou celular para retorno';
    end if;
    if normalized_privacy_type not in ('access', 'correction', 'deletion', 'consent', 'other') then
      raise exception 'Escolha o tipo da solicitação de privacidade';
    end if;
  else
    normalized_privacy_type := null;
  end if;

  if requested_profile_id is not null and exists (
    select 1 from public.profiles profile where profile.id = requested_profile_id
  ) then
    linked_profile_id := requested_profile_id;
  end if;

  insert into public.site_feedback (
    protocol,
    public_request_key,
    profile_id,
    category,
    customer_name,
    customer_email,
    customer_phone,
    page_url,
    message,
    privacy_request_type,
    privacy_due_at
  ) values (
    'ADO-' || to_char(now() at time zone 'America/Fortaleza', 'YYYYMMDD') || '-' ||
      upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
    requested_operation_key,
    linked_profile_id,
    requested_category,
    left(btrim(requested_customer_name), 120),
    nullif(left(lower(btrim(coalesce(requested_customer_email, ''))), 200), ''),
    nullif(left(btrim(coalesce(requested_customer_phone, '')), 24), ''),
    left(btrim(coalesce(requested_page_url, '')), 500),
    left(btrim(requested_message), 3000),
    normalized_privacy_type,
    case when requested_category = 'privacy' then now() + interval '15 days' else null end
  )
  returning * into created_feedback;

  insert into public.outbox_events (
    topic,
    aggregate_type,
    aggregate_id,
    payload
  ) values (
    'site_feedback.created',
    'site_feedback',
    created_feedback.id,
    jsonb_build_object(
      'protocol', created_feedback.protocol,
      'category', created_feedback.category,
      'privacy_request_type', created_feedback.privacy_request_type,
      'privacy_due_at', created_feedback.privacy_due_at,
      'profile_linked', created_feedback.profile_id is not null
    )
  );

  return jsonb_build_object(
    'protocol', created_feedback.protocol,
    'idempotent', false
  );
end;
$$;

create or replace function public.submit_site_feedback_bff(
  requested_operation_key uuid,
  requested_profile_id uuid,
  requested_category text,
  requested_customer_name text,
  requested_customer_email text,
  requested_customer_phone text,
  requested_page_url text,
  requested_message text
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.submit_site_feedback_bff(
    requested_operation_key,
    requested_profile_id,
    requested_category,
    requested_customer_name,
    requested_customer_email,
    requested_customer_phone,
    requested_page_url,
    requested_message,
    case when requested_category = 'privacy' then 'other' else null end
  );
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
    'updated_at', updated_row.updated_at
  );
end;
$$;

revoke all on function public.submit_site_feedback_bff(
  uuid,uuid,text,text,text,text,text,text,text
) from public, anon, authenticated;
grant execute on function public.submit_site_feedback_bff(
  uuid,uuid,text,text,text,text,text,text,text
) to service_role;

revoke all on function public.submit_site_feedback_bff(
  uuid,uuid,text,text,text,text,text,text
) from public, anon, authenticated;
grant execute on function public.submit_site_feedback_bff(
  uuid,uuid,text,text,text,text,text,text
) to service_role;

revoke all on function public.staff_list_privacy_requests(text,integer)
  from public, anon;
grant execute on function public.staff_list_privacy_requests(text,integer)
  to authenticated;

revoke all on function public.staff_update_privacy_request(uuid,text,text)
  from public, anon;
grant execute on function public.staff_update_privacy_request(uuid,text,text)
  to authenticated;

commit;
