begin;

create index if not exists ledger_entries_subject_positive_created_idx
  on public.ledger_entries(subject_profile_id, created_at desc)
  where stamps_delta > 0;

create or replace function public.staff_customer_directory(
  search_text text default '',
  status_filter text default 'active',
  registered_from date default null,
  registered_to date default null,
  min_stamps integer default null,
  max_stamps integer default null,
  last_stamp_from date default null,
  last_stamp_to date default null,
  has_available_reward boolean default null,
  sort_by text default 'name_asc',
  page_number integer default 1,
  page_size integer default 50
)
returns table(
  profile_id uuid, account_id uuid, full_name text, phone_e164 text, email text,
  member_code text, account_status text, current_progress smallint,
  completed_cards integer, available_rewards bigint, created_at timestamptz,
  last_stamp_at timestamptz, birth_date date, preferred_channel text,
  postal_code text, address_line text, address_number text,
  address_complement text, neighborhood text, city text, state_code text,
  total_count bigint
)
language plpgsql security definer set search_path = ''
as $$
declare safe_page integer := greatest(coalesce(page_number, 1), 1);
declare safe_size integer := least(greatest(coalesce(page_size, 50), 1), 100);
begin
  if (select auth.uid()) is null or not private.staff_has_any_capability('manage_customers') then
    raise exception 'Acesso a clientes nao autorizado';
  end if;
  if sort_by not in ('name_asc','name_desc','created_desc','created_asc','stamps_desc','last_stamp_desc') then
    raise exception 'Ordenacao invalida';
  end if;
  return query
  with directory as (
    select p.id profile_id, a.id account_id, p.full_name, p.phone_e164, p.email,
      p.member_code, p.account_status::text account_status, t.current_progress,
      t.completed_cards, count(distinct r.id) filter (where r.status='available')::bigint available_rewards,
      p.created_at, max(le.created_at) filter (where le.stamps_delta > 0) last_stamp_at,
      p.birth_date, p.preferred_channel, p.postal_code, p.address_line,
      p.address_number, p.address_complement, p.neighborhood, p.city, p.state_code
    from public.profiles p
    join public.account_memberships m on m.profile_id=p.id and m.active and m.is_primary
    join public.loyalty_accounts a on a.id=m.account_id and a.active
    join public.loyalty_tracks t on t.account_id=a.id and t.kind='main'
    left join public.rewards r on r.track_id=t.id
    left join public.ledger_entries le on le.track_id=t.id and le.subject_profile_id=p.id and le.stamps_delta>0
    where p.active and p.account_status <> 'anonymized'
      and (status_filter is null or status_filter='' or status_filter='all' or p.account_status::text=status_filter)
      and (registered_from is null or p.created_at >= registered_from)
      and (registered_to is null or p.created_at < registered_to + 1)
      and (search_text is null or btrim(search_text)='' or lower(p.full_name) like '%'||lower(btrim(search_text))||'%'
        or lower(coalesce(p.email,'')) like '%'||lower(btrim(search_text))||'%'
        or (char_length(regexp_replace(search_text,'[^0-9]','','g')) >= 4
          and regexp_replace(coalesce(p.phone_e164,''),'[^0-9]','','g') like '%'||regexp_replace(search_text,'[^0-9]','','g')||'%'))
    group by p.id,a.id,t.current_progress,t.completed_cards
  ), filtered as (
    select * from directory d where
      (min_stamps is null or d.current_progress >= min_stamps)
      and (max_stamps is null or d.current_progress <= max_stamps)
      and (last_stamp_from is null or d.last_stamp_at >= last_stamp_from)
      and (last_stamp_to is null or d.last_stamp_at < last_stamp_to + 1)
      and (has_available_reward is null or (d.available_rewards > 0)=has_available_reward)
  )
  select f.*, count(*) over() total_count from filtered f
  order by
    case when sort_by='name_asc' then lower(f.full_name) end asc,
    case when sort_by='name_desc' then lower(f.full_name) end desc,
    case when sort_by='created_desc' then f.created_at end desc,
    case when sort_by='created_asc' then f.created_at end asc,
    case when sort_by='stamps_desc' then f.current_progress end desc,
    case when sort_by='last_stamp_desc' then f.last_stamp_at end desc nulls last,
    f.profile_id
  limit safe_size offset (safe_page-1)*safe_size;
end $$;

revoke all on function public.staff_customer_directory(text,text,date,date,integer,integer,date,date,boolean,text,integer,integer) from public, anon;
grant execute on function public.staff_customer_directory(text,text,date,date,integer,integer,date,date,boolean,text,integer,integer) to authenticated;

commit;
