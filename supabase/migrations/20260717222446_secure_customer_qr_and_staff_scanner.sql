create table if not exists public.customer_qr_tokens (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  account_id uuid not null references public.loyalty_accounts(id) on delete cascade,
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_qr_tokens enable row level security;

create policy customer_qr_tokens_read_own on public.customer_qr_tokens
  for select to authenticated
  using (profile_id = (select auth.uid()) or private.is_staff());

grant select on public.customer_qr_tokens to authenticated;

create or replace function public.issue_customer_qr()
returns table(token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_profile_id uuid := (select auth.uid());
  current_account_id uuid;
  raw_token text;
  valid_until timestamptz := now() + interval '15 minutes';
begin
  if current_profile_id is null then
    raise exception 'Faça login para abrir seu QR.';
  end if;

  select membership.account_id
    into current_account_id
  from public.account_memberships membership
  where membership.profile_id = current_profile_id
    and membership.active
  order by membership.is_primary desc, membership.joined_at
  limit 1;

  if current_account_id is null then
    raise exception 'Conta fidelidade não encontrada.';
  end if;

  raw_token := encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.customer_qr_tokens as qr (
    profile_id, account_id, token_hash, expires_at, updated_at
  ) values (
    current_profile_id,
    current_account_id,
    extensions.digest(raw_token, 'sha256'),
    valid_until,
    now()
  )
  on conflict (profile_id) do update set
    account_id = excluded.account_id,
    token_hash = excluded.token_hash,
    expires_at = excluded.expires_at,
    updated_at = now();

  return query select raw_token, valid_until;
end;
$$;

create or replace function public.staff_lookup_customer_by_qr(qr_value text)
returns table(profile_id uuid, full_name text, phone_e164 text, email text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_token text;
  match_parts text[];
begin
  if (select auth.uid()) is null or not private.is_staff() then
    raise exception 'Acesso não autorizado.';
  end if;

  match_parts := regexp_match(coalesce(qr_value, ''), '[?&]cartao=([a-fA-F0-9]{48})');
  normalized_token := lower(coalesce(match_parts[1], btrim(qr_value)));

  if normalized_token !~ '^[a-f0-9]{48}$' then
    raise exception 'Este QR não pertence ao Clube Adoce.';
  end if;

  return query
  select profile.id, profile.full_name, profile.phone_e164, profile.email::text
  from public.customer_qr_tokens qr
  join public.profiles profile on profile.id = qr.profile_id
  where qr.token_hash = extensions.digest(normalized_token, 'sha256')
    and qr.expires_at > now()
  limit 1;
end;
$$;

revoke all on function public.issue_customer_qr() from public, anon;
revoke all on function public.staff_lookup_customer_by_qr(text) from public, anon;
grant execute on function public.issue_customer_qr() to authenticated;
grant execute on function public.staff_lookup_customer_by_qr(text) to authenticated;
