begin;

create or replace function public.staff_search_customers(search_text text default '')
returns table (
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
begin
  if (select auth.uid()) is null or not private.is_staff() then
    raise exception 'Acesso não autorizado';
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
    (array_agg(r.id order by r.created_at)
      filter (where r.status = 'available'))[1]
  from public.profiles p
  join public.account_memberships m
    on m.profile_id = p.id and m.active and m.is_primary
  join public.loyalty_accounts a on a.id = m.account_id and a.active
  join public.loyalty_tracks t on t.account_id = a.id and t.kind = 'main'
  left join public.rewards r on r.track_id = t.id
  where search_text is null
     or trim(search_text) = ''
     or p.full_name ilike '%' || trim(search_text) || '%'
     or coalesce(p.phone_e164, '') like '%' || regexp_replace(search_text, '[^0-9]', '', 'g') || '%'
     or coalesce(p.email, '') ilike '%' || trim(search_text) || '%'
  group by p.id, a.id, p.full_name, p.phone_e164, p.email,
           t.current_progress, t.completed_cards, p.updated_at
  order by p.updated_at desc
  limit 30;
end;
$$;

revoke all on function public.staff_search_customers(text) from public, anon;
grant execute on function public.staff_search_customers(text) to authenticated;

commit;
