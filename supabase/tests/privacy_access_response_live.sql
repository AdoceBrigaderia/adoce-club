begin;

do $$
declare
  actor_id uuid;
  profile_id uuid;
  feedback_id uuid;
  protocol_value text := 'PRIV-ACCESS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  package jsonb;
  delivered jsonb;
  requests jsonb;
  selected jsonb;
  prepared_audit boolean;
  delivered_audit boolean;
begin
  select member.user_id
  into actor_id
  from public.staff_members member
  where member.active
    and member.role::text in ('owner', 'manager')
  order by case member.role::text when 'owner' then 1 else 2 end
  limit 1;

  if actor_id is null then
    raise exception 'Homologação precisa de proprietário ou gestor ativo para o ensaio';
  end if;

  select profile.id
  into profile_id
  from public.profiles profile
  where coalesce(profile.active, true)
  order by profile.created_at
  limit 1;

  if profile_id is null then
    raise exception 'Homologação precisa de ao menos um cadastro ativo para o ensaio';
  end if;

  insert into public.site_feedback(
    protocol,
    public_request_key,
    profile_id,
    category,
    customer_name,
    customer_email,
    page_url,
    message,
    privacy_request_type,
    privacy_due_at,
    privacy_identity_status,
    privacy_identity_checked_at,
    privacy_identity_checked_by,
    privacy_identity_notes
  )
  select
    protocol_value,
    gen_random_uuid(),
    profile.id,
    'privacy',
    profile.full_name,
    profile.email,
    'https://homologacao-adoce--adoce-homologacao.netlify.app/#operacao',
    'Solicitação temporária para validar o pacote auditado de consulta de dados.',
    'access',
    now() + interval '15 days',
    'verified',
    now(),
    actor_id,
    'Identidade confirmada em ensaio transacional com rollback.'
  from public.profiles profile
  where profile.id = profile_id
  returning id into feedback_id;

  perform set_config('request.jwt.claim.sub', actor_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', actor_id, 'role', 'authenticated')::text,
    true
  );

  package := public.staff_prepare_privacy_access_response(feedback_id);

  if package->'metadata'->>'protocol' is distinct from protocol_value then
    raise exception 'Pacote não preservou o protocolo';
  end if;
  if package->'metadata'->>'package_version' is null then
    raise exception 'Pacote não recebeu versão';
  end if;
  if package->'profile'->>'id' is distinct from profile_id::text then
    raise exception 'Pacote não pertence ao cadastro vinculado';
  end if;
  if package ? 'notes' or package ? 'tags' then
    raise exception 'Pacote expôs conteúdo interno do CRM';
  end if;
  if jsonb_typeof(package->'consents') is distinct from 'array' then
    raise exception 'Consentimentos não foram retornados em formato seguro';
  end if;

  requests := public.staff_list_privacy_requests(null, 100);
  select entry
  into selected
  from jsonb_array_elements(requests) entry
  where entry->>'id' = feedback_id::text
  limit 1;

  if selected->>'privacy_response_prepared_at' is null
     or selected->>'privacy_response_package_version' is null then
    raise exception 'Fila não exibiu o estado do pacote preparado';
  end if;

  delivered := public.staff_mark_privacy_response_delivered(
    feedback_id,
    'email',
    'Entrega de teste registrada em transação com rollback.'
  );

  if delivered->>'status' is distinct from 'resolved'
     or delivered->>'privacy_response_delivery_channel' is distinct from 'email'
     or delivered->>'privacy_response_delivered_at' is null then
    raise exception 'Entrega não foi registrada corretamente';
  end if;

  select exists(
    select 1
    from public.audit_events event
    where event.action = 'privacy_request.access_package_prepared'
      and event.entity_id = feedback_id::text
  ) into prepared_audit;

  select exists(
    select 1
    from public.audit_events event
    where event.action = 'privacy_request.response_delivered'
      and event.entity_id = feedback_id::text
  ) into delivered_audit;

  if not prepared_audit or not delivered_audit then
    raise exception 'Auditoria do pacote e da entrega não foi registrada';
  end if;

  if has_function_privilege(
    'anon',
    'public.staff_prepare_privacy_access_response(uuid)'::regprocedure,
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.staff_mark_privacy_response_delivered(uuid,text,text)'::regprocedure,
    'EXECUTE'
  ) then
    raise exception 'RPC do pacote de privacidade exposto ao anônimo';
  end if;
end;
$$;

rollback;
