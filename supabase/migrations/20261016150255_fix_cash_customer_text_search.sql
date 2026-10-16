begin;

create extension if not exists unaccent with schema extensions;

create or replace function public.staff_search_customers(search_text text default '')
returns table(
  profile_id uuid,
  account_id uuid,
  full_name text,
  phone_e164 text,
  email text,
  current_progress smallint,
  completed_cards integer,
  available_rewards bigint,
  available_reward_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_text text := extensions.unaccent(lower(trim(coalesce(search_text, ''))));
  normalized_digits text := nullif(regexp_replace(trim(search_text), '[^0-9]', '', 'g'), '');
begin
  if (select auth.uid()) is null
     or not private.staff_has_any_capability('manage_customers') then
    raise exception 'Acesso a clientes nao autorizado';
  end if;

  return query
  select
    p.id,
    a.id,
    p.full_name,
    p.phone_e164,
    p.email,
    t.current_progress,
    t.completed_cards,
    count(r.id) filter (where r.status = 'available')::bigint,
    (min(r.id::text) filter (where r.status = 'available'))::uuid
  from public.profiles p
  join public.account_memberships m
    on m.profile_id = p.id and m.active and m.is_primary
  join public.loyalty_accounts a on a.id = m.account_id and a.active
  join public.loyalty_tracks t on t.account_id = a.id and t.kind = 'main'
  left join public.rewards r on r.track_id = t.id
  where p.active
    and p.account_status = 'active'
    and (
      normalized_text = ''
      or extensions.unaccent(lower(p.full_name)) like '%' || normalized_text || '%'
      or (
        normalized_digits is not null
        and regexp_replace(coalesce(p.phone_e164, ''), '[^0-9]', '', 'g')
          like '%' || normalized_digits || '%'
      )
      or extensions.unaccent(lower(coalesce(p.email, ''))) like '%' || normalized_text || '%'
    )
  group by p.id, a.id, p.full_name, p.phone_e164, p.email,
           t.current_progress, t.completed_cards
  order by extensions.unaccent(lower(p.full_name)), p.full_name, p.phone_e164 nulls last;
end;
$$;

revoke all on function public.staff_search_customers(text) from public, anon;
grant execute on function public.staff_search_customers(text) to authenticated;

commit;
