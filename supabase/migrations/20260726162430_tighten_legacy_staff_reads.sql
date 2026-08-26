begin;

create or replace function private.staff_has_any_capability(requested_capability text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_members s
    left join public.staff_store_assignments a
      on a.staff_user_id = s.user_id and a.active
    where s.user_id = (select auth.uid())
      and s.active
      and (
        s.role::text in ('owner', 'manager')
        or case requested_capability
          when 'sell' then a.can_sell
          when 'open_cash' then a.can_open_cash
          when 'close_cash' then a.can_close_cash
          when 'manage_stock' then a.can_manage_stock
          when 'view_finance' then a.can_view_finance
          when 'manage_customers' then a.can_manage_customers
          when 'manage_loyalty' then a.can_manage_customers
          when 'manage_orders' then a.can_manage_orders
          when 'manage_production' then a.can_manage_production
          when 'view_reports' then a.can_view_reports
          when 'manage_settings' then a.can_manage_settings
          else false
        end
      )
  );
$$;

create or replace function public.staff_financial_sales_summary(range_start date, range_end date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if (select auth.uid()) is null or not private.staff_has_any_capability('view_finance') then
    raise exception 'Acesso financeiro nao autorizado';
  end if;
  if range_start is null or range_end is null or range_end < range_start or range_end - range_start > 370 then
    raise exception 'Escolha um periodo valido de ate 370 dias';
  end if;
  with sales as (
    select target.* from public.instant_orders target
    where target.payment_status = 'approved'
      and (coalesce(target.payment_recorded_at, target.paid_at, target.created_at) at time zone 'America/Fortaleza')::date between range_start and range_end
  ), by_method as (
    select coalesce(payment_method_code,'not_informed') code,
      coalesce(max(payment_method_label),'Nao informado') label, count(*) orders,
      sum(gross_amount) gross, sum(payment_fee_amount) fees, sum(net_amount) net
    from sales group by coalesce(payment_method_code,'not_informed')
  ), by_day as (
    select (coalesce(payment_recorded_at, paid_at, created_at) at time zone 'America/Fortaleza')::date sale_date,
      count(*) orders, sum(gross_amount) gross, sum(payment_fee_amount) fees, sum(net_amount) net
    from sales group by 1
  )
  select jsonb_build_object(
    'from', range_start, 'to', range_end, 'orders', (select count(*) from sales),
    'gross', coalesce((select sum(gross_amount) from sales),0),
    'fees', coalesce((select sum(payment_fee_amount) from sales),0),
    'net', coalesce((select sum(net_amount) from sales),0),
    'by_method', coalesce((select jsonb_agg(to_jsonb(by_method) order by gross desc) from by_method),'[]'::jsonb),
    'by_day', coalesce((select jsonb_agg(to_jsonb(by_day) order by sale_date desc) from by_day),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;

create or replace function public.staff_get_commerce_settings()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if (select auth.uid()) is null or not private.staff_has_any_capability('manage_settings') then
    raise exception 'Acesso as configuracoes nao autorizado';
  end if;
  select jsonb_build_object(
    'automatic_checkout_enabled', settings.automatic_checkout_enabled,
    'automatic_checkout_minimum', settings.automatic_checkout_minimum,
    'reservation_minutes', settings.reservation_minutes,
    'payment_methods', coalesce((select jsonb_agg(jsonb_build_object(
      'code', method.code, 'label', method.label, 'fee_percent', method.fee_percent,
      'fee_fixed', method.fee_fixed, 'active', method.active,
      'customer_selectable', method.customer_selectable, 'sort_order', method.sort_order
    ) order by method.sort_order, method.label) from public.payment_methods method), '[]'::jsonb)
  ) into result
  from private.instant_order_settings settings where settings.singleton;
  return result;
end;
$$;

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
begin
  if (select auth.uid()) is null or not private.staff_has_any_capability('manage_customers') then
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
  where search_text is null
     or trim(search_text) = ''
     or lower(p.full_name) like '%' || lower(trim(search_text)) || '%'
     or coalesce(p.phone_e164, '') like '%' || regexp_replace(search_text, '[^0-9]', '', 'g') || '%'
     or lower(coalesce(p.email, '')) like '%' || lower(trim(search_text)) || '%'
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

  if normalized_token !~ '^[a-f0-9]{48}$' then
    raise exception 'Este QR nao pertence ao Clube Adoce';
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

commit;
