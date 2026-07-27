begin;

do $$
declare
  test_subject text := repeat('a', 64);
  first_result jsonb;
  second_result jsonb;
  third_result jsonb;
begin
  first_result := public.consume_public_endpoint_rate_limit_bff(
    'feedback:test', test_subject, 3600, 2
  );
  second_result := public.consume_public_endpoint_rate_limit_bff(
    'feedback:test', test_subject, 3600, 2
  );
  third_result := public.consume_public_endpoint_rate_limit_bff(
    'feedback:test', test_subject, 3600, 2
  );

  if not coalesce((first_result->>'allowed')::boolean, false) then
    raise exception 'A primeira solicitação deveria ser permitida';
  end if;
  if not coalesce((second_result->>'allowed')::boolean, false) then
    raise exception 'A segunda solicitação deveria ser permitida';
  end if;
  if coalesce((third_result->>'allowed')::boolean, true) then
    raise exception 'A terceira solicitação deveria ser bloqueada';
  end if;
  if coalesce((third_result->>'retry_after_seconds')::integer, 0) <= 0 then
    raise exception 'O bloqueio deveria informar tempo de espera';
  end if;
end;
$$;

rollback;
