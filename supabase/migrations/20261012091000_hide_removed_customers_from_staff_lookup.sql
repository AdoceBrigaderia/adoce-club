create or replace function public.staff_search_customers(search_text text default '')
returns table(
  profile_id uuid, account_id uuid, full_name text, phone_e164 text, email text,
  current_progress smallint, completed_cards integer, available_rewards bigint,
  available_reward_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.staff_has_any_capability('manage_customers') then
    raise exception 'Acesso a clientes nao autorizado';
  end if;

  return query
  select p.id, a.id, p.full_name, p.phone_e164, p.email, t.current_progress,
    t.completed_cards, count(r.id) filter (where r.status = 'available')::bigint,
    (min(r.id::text) filter (where r.status = 'available'))::uuid
  from public.profiles p
  join public.account_memberships m on m.profile_id = p.id and m.active and m.is_primary
  join public.loyalty_accounts a on a.id = m.account_id and a.active
  join public.loyalty_tracks t on t.account_id = a.id and t.kind = 'main'
  left join public.rewards r on r.track_id = t.id
  where p.active
    and p.account_status = 'active'
    and (
      search_text is null or trim(search_text) = ''
      or lower(p.full_name) like '%' || lower(trim(search_text)) || '%'
      or coalesce(p.phone_e164, '') like '%' || regexp_replace(search_text, '[^0-9]', '', 'g') || '%'
      or lower(coalesce(p.email, '')) like '%' || lower(trim(search_text)) || '%'
    )
  group by p.id, a.id, p.full_name, p.phone_e164, p.email,
           t.current_progress, t.completed_cards, p.updated_at
  order by p.updated_at desc
  limit 30;
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
  if (select auth.uid()) is null or not private.staff_has_any_capability('manage_customers') then
    raise exception 'Acesso a clientes nao autorizado';
  end if;
  match_parts := regexp_match(coalesce(qr_value, ''), '[?&]cartao=([a-fA-F0-9]{48})');
  normalized_token := lower(coalesce(match_parts[1], btrim(qr_value)));
  if normalized_token !~ '^[a-f0-9]{48}$' then raise exception 'Este QR nao pertence ao Clube Adoce'; end if;
  return query
  select profile.id, profile.full_name, profile.phone_e164, profile.email::text
  from public.customer_qr_tokens qr
  join public.profiles profile on profile.id = qr.profile_id
  where qr.token_hash = extensions.digest(normalized_token, 'sha256')
    and qr.expires_at > now()
    and profile.active
    and profile.account_status = 'active'
  limit 1;
end;
$$;
