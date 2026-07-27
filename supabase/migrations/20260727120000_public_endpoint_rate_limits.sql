begin;

create table if not exists private.public_endpoint_rate_limits (
  bucket text not null,
  subject_hash text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (bucket, subject_hash),
  constraint public_endpoint_rate_limits_count_check check (request_count >= 0),
  constraint public_endpoint_rate_limits_subject_check check (
    char_length(subject_hash) between 32 and 128
  )
);

revoke all on table private.public_endpoint_rate_limits
  from public, anon, authenticated;
grant all on table private.public_endpoint_rate_limits to service_role;

create or replace function public.consume_public_endpoint_rate_limit_bff(
  requested_bucket text,
  requested_subject_hash text,
  requested_window_seconds integer,
  requested_max_requests integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_bucket text := left(lower(btrim(coalesce(requested_bucket, ''))), 80);
  normalized_subject text := lower(btrim(coalesce(requested_subject_hash, '')));
  current_time timestamptz := clock_timestamp();
  current_row private.public_endpoint_rate_limits%rowtype;
  next_count integer;
  retry_after integer;
begin
  if normalized_bucket !~ '^[a-z0-9][a-z0-9:_-]{1,79}$' then
    raise exception 'Bucket de limite inválido';
  end if;
  if normalized_subject !~ '^[a-f0-9]{64}$' then
    raise exception 'Identificador do limite inválido';
  end if;
  if requested_window_seconds not between 10 and 86400 then
    raise exception 'Janela do limite inválida';
  end if;
  if requested_max_requests not between 1 and 1000 then
    raise exception 'Quantidade máxima inválida';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(normalized_bucket || ':' || normalized_subject, 0)
  );

  select limit_row.*
  into current_row
  from private.public_endpoint_rate_limits limit_row
  where limit_row.bucket = normalized_bucket
    and limit_row.subject_hash = normalized_subject
  for update;

  if current_row.bucket is null
     or current_row.window_started_at <=
       current_time - make_interval(secs => requested_window_seconds) then
    insert into private.public_endpoint_rate_limits(
      bucket,
      subject_hash,
      window_started_at,
      request_count,
      updated_at
    ) values (
      normalized_bucket,
      normalized_subject,
      current_time,
      1,
      current_time
    )
    on conflict (bucket, subject_hash) do update
      set window_started_at = excluded.window_started_at,
          request_count = 1,
          updated_at = excluded.updated_at;

    return jsonb_build_object(
      'allowed', true,
      'remaining', greatest(requested_max_requests - 1, 0),
      'retry_after_seconds', 0
    );
  end if;

  next_count := current_row.request_count + 1;
  retry_after := greatest(
    1,
    ceil(
      extract(epoch from (
        current_row.window_started_at
          + make_interval(secs => requested_window_seconds)
          - current_time
      ))
    )::integer
  );

  if next_count > requested_max_requests then
    update private.public_endpoint_rate_limits
    set updated_at = current_time
    where bucket = normalized_bucket
      and subject_hash = normalized_subject;

    return jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'retry_after_seconds', retry_after
    );
  end if;

  update private.public_endpoint_rate_limits
  set request_count = next_count,
      updated_at = current_time
  where bucket = normalized_bucket
    and subject_hash = normalized_subject;

  return jsonb_build_object(
    'allowed', true,
    'remaining', greatest(requested_max_requests - next_count, 0),
    'retry_after_seconds', 0
  );
end;
$$;

revoke all on function public.consume_public_endpoint_rate_limit_bff(
  text,text,integer,integer
) from public, anon, authenticated;
grant execute on function public.consume_public_endpoint_rate_limit_bff(
  text,text,integer,integer
) to service_role;

create index if not exists public_endpoint_rate_limits_updated_idx
  on private.public_endpoint_rate_limits (updated_at);

commit;
