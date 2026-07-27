begin;

do $$
declare
  actor_id uuid;
  test_name text := 'Teste Operacional Privacidade ' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  requests jsonb;
  selected jsonb;
  updated jsonb;
  resolved jsonb;
  audit_found boolean;
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

  insert into public.site_feedback(
    protocol,
    public_request_key,
    category,
    customer_name,
    customer_email,
    page_url,
    message,
    privacy_request_type,
    privacy_due_at
  ) values (
    'PRIV-LIVE-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
    gen_random_uuid(),
    'privacy',
    test_name,
    'privacy-operation@example.com',
    'https://homologacao-adoce--adoce-homologacao.netlify.app/#operacao',
    'Solicitação temporária para validar listagem, atualização, prazo e auditoria operacional.',
    'access',
    now() + interval '15 days'
  );

  perform set_config('request.jwt.claim.sub', actor_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', actor_id, 'role', 'authenticated')::text,
    true
  );

  requests := public.staff_list_privacy_requests(null, 100);

  select entry
  into selected
  from jsonb_array_elements(requests) entry
  where entry->>'customer_name' = test_name
  limit 1;

  if selected is null then
    raise exception 'Solicitação de teste não apareceu na listagem';
  end if;
  if selected->>'privacy_request_type' is distinct from 'access' then
    raise exception 'Tipo da solicitação não foi preservado';
  end if;
  if coalesce((selected->>'overdue')::boolean, true) then
    raise exception 'Solicitação nova foi marcada como atrasada';
  end if;
  if selected->>'privacy_due_at' is null then
    raise exception 'Prazo interno não foi retornado';
  end if;

  updated := public.staff_update_privacy_request(
    (selected->>'id')::uuid,
    'reviewing',
    'Validado em ensaio vivo com rollback.'
  );

  if updated->>'status' is distinct from 'reviewing' then
    raise exception 'Status não foi atualizado';
  end if;

  resolved := public.staff_update_privacy_request(
    (selected->>'id')::uuid,
    'resolved',
    'Solicitação resolvida durante ensaio vivo com rollback.'
  );

  if resolved->>'privacy_resolved_at' is null then
    raise exception 'Momento da resolução não foi registrado';
  end if;

  select exists(
    select 1
    from public.audit_events event
    where event.action = 'privacy_request.updated'
      and event.entity_id = selected->>'id'
  ) into audit_found;

  if not audit_found then
    raise exception 'Auditoria da privacidade não foi registrada';
  end if;

  if has_function_privilege(
    'anon',
    'public.staff_list_privacy_requests(text,integer)'::regprocedure,
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.staff_update_privacy_request(uuid,text,text)'::regprocedure,
    'EXECUTE'
  ) then
    raise exception 'RPC operacional de privacidade exposto ao anônimo';
  end if;
end;
$$;

rollback;
