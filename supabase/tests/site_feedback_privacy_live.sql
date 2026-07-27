begin;

do $$
declare
  operation_id uuid := gen_random_uuid();
  response jsonb;
  created_id uuid;
  routed text;
begin
  response := public.submit_site_feedback_bff(
    operation_id,
    null,
    'privacy',
    'Teste de Privacidade',
    'privacidade.teste@example.com',
    null,
    'https://homologacao-adoce--adoce-homologacao.netlify.app/#privacidade',
    'Solicitação temporária para validar o roteamento de privacidade.'
  );

  if coalesce(response->>'protocol', '') = '' then
    raise exception 'Protocolo não foi gerado';
  end if;

  select feedback.id
  into created_id
  from public.site_feedback feedback
  where feedback.public_request_key = operation_id;

  if created_id is null then
    raise exception 'Feedback de teste não foi criado';
  end if;

  select event.payload->>'notification_route'
  into routed
  from public.outbox_events event
  where event.topic = 'site_feedback.created'
    and event.aggregate_id = created_id
  order by event.created_at desc
  limit 1;

  if routed is distinct from 'business.privacidade' then
    raise exception 'Rota incorreta: %', routed;
  end if;

  if has_function_privilege(
    'anon',
    'public.submit_site_feedback_bff(uuid,uuid,text,text,text,text,text,text)'::regprocedure,
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.submit_site_feedback_bff(uuid,uuid,text,text,text,text,text,text)'::regprocedure,
    'EXECUTE'
  ) then
    raise exception 'RPC de feedback permanece exposto ao navegador';
  end if;
end;
$$;

rollback;
