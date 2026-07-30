begin;

do $$
declare
  operation_key uuid := gen_random_uuid();
  first_result jsonb;
  repeated_result jsonb;
  created_feedback public.site_feedback%rowtype;
  event_payload jsonb;
  invalid_type_blocked boolean := false;
begin
  first_result := public.submit_site_feedback_bff(
    operation_key,
    null,
    'privacy',
    'Cliente Teste Privacidade',
    'privacy-types@example.com',
    null,
    'https://homologacao-adoce--adoce-homologacao.netlify.app/#fale-com-a-adoce?tipo=privacy',
    'Quero consultar os dados pessoais associados ao meu cadastro de teste.',
    'access'
  );

  if first_result->>'protocol' is null
     or coalesce((first_result->>'idempotent')::boolean, true) then
    raise exception 'Primeira solicitação não foi criada corretamente';
  end if;

  repeated_result := public.submit_site_feedback_bff(
    operation_key,
    null,
    'privacy',
    'Cliente Teste Privacidade',
    'privacy-types@example.com',
    null,
    'https://homologacao-adoce--adoce-homologacao.netlify.app/#fale-com-a-adoce?tipo=privacy',
    'Quero consultar os dados pessoais associados ao meu cadastro de teste.',
    'access'
  );

  if repeated_result->>'protocol' is distinct from first_result->>'protocol'
     or not coalesce((repeated_result->>'idempotent')::boolean, false) then
    raise exception 'Idempotência da solicitação de privacidade falhou';
  end if;

  select feedback.*
  into created_feedback
  from public.site_feedback feedback
  where feedback.public_request_key = operation_key;

  if created_feedback.privacy_request_type is distinct from 'access' then
    raise exception 'Tipo estruturado não foi gravado';
  end if;
  if created_feedback.privacy_due_at is null
     or created_feedback.privacy_due_at < now() + interval '14 days'
     or created_feedback.privacy_due_at > now() + interval '16 days' then
    raise exception 'Prazo interno não foi calculado em torno de 15 dias';
  end if;

  select event.payload
  into event_payload
  from public.outbox_events event
  where event.topic = 'site_feedback.created'
    and event.aggregate_id = created_feedback.id
  order by event.created_at desc
  limit 1;

  if event_payload->>'privacy_request_type' is distinct from 'access'
     or event_payload->>'notification_route' is distinct from 'business.privacidade' then
    raise exception 'Outbox não preservou tipo e rota de privacidade';
  end if;

  begin
    perform public.submit_site_feedback_bff(
      gen_random_uuid(),
      null,
      'privacy',
      'Cliente Tipo Inválido',
      'privacy-invalid@example.com',
      null,
      'https://homologacao-adoce--adoce-homologacao.netlify.app/',
      'Solicitação temporária com tipo inválido para confirmar o bloqueio.',
      'unknown'
    );
  exception
    when others then
      invalid_type_blocked := position('tipo da solicitação' in lower(sqlerrm)) > 0;
  end;

  if not invalid_type_blocked then
    raise exception 'Tipo de privacidade inválido não foi bloqueado';
  end if;

  if has_function_privilege(
    'anon',
    'public.submit_site_feedback_bff(uuid,uuid,text,text,text,text,text,text,text)'::regprocedure,
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.submit_site_feedback_bff(uuid,uuid,text,text,text,text,text,text,text)'::regprocedure,
    'EXECUTE'
  ) then
    raise exception 'RPC estruturado de privacidade exposto ao navegador';
  end if;
end;
$$;

rollback;
