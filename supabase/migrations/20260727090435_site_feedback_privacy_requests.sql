begin;

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
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_feedback public.site_feedback%rowtype;
  created_feedback public.site_feedback%rowtype;
  linked_profile_id uuid;
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
  if requested_category = 'privacy'
     and nullif(btrim(coalesce(requested_customer_email, '')), '') is null
     and nullif(btrim(coalesce(requested_customer_phone, '')), '') is null then
    raise exception 'Informe um e-mail ou celular para retorno';
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
    message
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
    left(btrim(requested_message), 3000)
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
      'profile_linked', created_feedback.profile_id is not null
    )
  );

  return jsonb_build_object(
    'protocol', created_feedback.protocol,
    'idempotent', false
  );
end;
$$;

revoke all on function public.submit_site_feedback_bff(
  uuid,uuid,text,text,text,text,text,text
) from public, anon, authenticated;
grant execute on function public.submit_site_feedback_bff(
  uuid,uuid,text,text,text,text,text,text
) to service_role;

create or replace function private.route_site_feedback_outbox()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_route text;
begin
  if new.topic = 'site_feedback.created' then
    target_route := case
      when coalesce(new.payload->>'category', '') = 'privacy'
        then 'business.privacidade'
      else 'business.atendimento'
    end;

    new.payload := coalesce(new.payload, '{}'::jsonb) || jsonb_build_object(
      'notification_channel', 'email',
      'notification_route', target_route
    );
  end if;

  return new;
end;
$$;

revoke all on function private.route_site_feedback_outbox()
  from public, anon, authenticated;

update public.outbox_events
set payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object(
  'notification_channel', 'email',
  'notification_route', case
    when coalesce(payload->>'category', '') = 'privacy'
      then 'business.privacidade'
    else 'business.atendimento'
  end
)
where topic = 'site_feedback.created';

commit;
