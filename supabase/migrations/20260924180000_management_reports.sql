-- Gestão contábil e fechamento completo (pedido de 24/09/2026)
-- 1. Número único e sequencial por caixa (caixas antigos numerados pela ordem de abertura).
-- 2. Perdas/descarte de fatias, custo por sabor e fila genérica de impressão térmica.
-- 3. Abertura guarda o estoque inicial; fechamento com demonstrativos completos,
--    relatório de sabores e consolidado do dia quando houver mais de um caixa.
-- 4. Relatório de gestão por período (somente gerência).

-- ---------------------------------------------------------------------------
-- 1. Numeração dos caixas
-- ---------------------------------------------------------------------------
create sequence if not exists public.cash_session_number_seq;
alter table public.cash_sessions add column if not exists session_number bigint;
with ordered as (
  select id, row_number() over (order by opened_at, id) as rn
  from public.cash_sessions
)
update public.cash_sessions s set session_number = o.rn
from ordered o where o.id = s.id and s.session_number is null;
select setval(
  'public.cash_session_number_seq',
  greatest(coalesce((select max(session_number) from public.cash_sessions), 0), 1),
  exists(select 1 from public.cash_sessions)
);
alter table public.cash_sessions alter column session_number set default nextval('public.cash_session_number_seq');
alter table public.cash_sessions alter column session_number set not null;
create unique index if not exists cash_sessions_session_number_key on public.cash_sessions(session_number);

-- ---------------------------------------------------------------------------
-- 2a. Perdas e descarte
-- ---------------------------------------------------------------------------
create table if not exists public.slice_losses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.cash_sessions(id),
  store_id uuid not null references public.stores(id),
  flavor_id uuid not null references public.flavors(id),
  service_date date not null,
  quantity integer not null check (quantity between 1 and 999),
  reason text not null check (char_length(btrim(reason)) between 3 and 200),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists slice_losses_session_idx on public.slice_losses(session_id);
create index if not exists slice_losses_date_idx on public.slice_losses(service_date);
alter table public.slice_losses enable row level security;
revoke all on public.slice_losses from public, anon, authenticated;
grant select on public.slice_losses to authenticated;
drop policy if exists slice_losses_staff_read on public.slice_losses;
create policy slice_losses_staff_read on public.slice_losses for select to authenticated
  using (private.is_staff() and private.can_access_store(store_id));

create or replace function public.staff_record_slice_loss(target_session_id uuid, target_flavor_id uuid, requested_quantity integer, requested_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.cash_sessions%rowtype; a public.flavor_availability%rowtype; today date := (now() at time zone 'America/Fortaleza')::date; loss public.slice_losses%rowtype; left_units integer;
begin
  select * into s from public.cash_sessions where id = target_session_id and status = 'open' for update;
  if auth.uid() is null or not private.is_staff() or s.id is null or not private.can_access_store(s.store_id) then
    raise exception 'Abra um caixa autorizado para lançar perdas';
  end if;
  if coalesce(requested_quantity, 0) < 1 then raise exception 'Informe a quantidade perdida'; end if;
  if char_length(btrim(coalesce(requested_reason, ''))) < 3 then raise exception 'Informe o motivo da perda'; end if;
  select * into a from public.flavor_availability where flavor_id = target_flavor_id and service_date = today for update;
  if a.id is null then raise exception 'Este sabor não tem estoque lançado hoje'; end if;
  if coalesce(a.quantity_available, 0) - coalesce(a.quantity_reserved, 0) < requested_quantity then
    raise exception 'A perda é maior que as fatias livres deste sabor';
  end if;
  left_units := a.quantity_available - requested_quantity;
  update public.flavor_availability
  set quantity_available = left_units,
      status = case
        when left_units - quantity_reserved <= 0 then 'sold_out'::public.availability_status
        when left_units - quantity_reserved <= 3 and status = 'available' then 'last_units'::public.availability_status
        else status end,
      updated_by = auth.uid(), updated_at = now()
  where id = a.id;
  insert into public.slice_losses(session_id, store_id, flavor_id, service_date, quantity, reason)
  values (s.id, s.store_id, target_flavor_id, today, requested_quantity, btrim(requested_reason))
  returning * into loss;
  return to_jsonb(loss);
end; $$;
revoke all on function public.staff_record_slice_loss(uuid, uuid, integer, text) from public, anon;
grant execute on function public.staff_record_slice_loss(uuid, uuid, integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2b. Custo por sabor (visível só para a gerência)
-- ---------------------------------------------------------------------------
create table if not exists public.flavor_costs (
  flavor_id uuid primary key references public.flavors(id) on delete cascade,
  unit_cost numeric(10,2) not null check (unit_cost >= 0),
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);
alter table public.flavor_costs enable row level security;
revoke all on public.flavor_costs from public, anon, authenticated;
grant select on public.flavor_costs to authenticated;
drop policy if exists flavor_costs_manager_read on public.flavor_costs;
create policy flavor_costs_manager_read on public.flavor_costs for select to authenticated using (private.is_manager());

create or replace function public.manager_set_flavor_cost(target_flavor_id uuid, requested_unit_cost numeric)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_manager() then raise exception 'Acesso não autorizado'; end if;
  if requested_unit_cost is null then
    delete from public.flavor_costs where flavor_id = target_flavor_id;
    return;
  end if;
  if requested_unit_cost < 0 then raise exception 'O custo não pode ser negativo'; end if;
  insert into public.flavor_costs(flavor_id, unit_cost, updated_by, updated_at)
  values (target_flavor_id, round(requested_unit_cost, 2), auth.uid(), now())
  on conflict (flavor_id) do update set unit_cost = excluded.unit_cost, updated_by = excluded.updated_by, updated_at = now();
end; $$;
revoke all on function public.manager_set_flavor_cost(uuid, numeric) from public, anon;
grant execute on function public.manager_set_flavor_cost(uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- 2c. Fila genérica de impressão térmica (o tablet imprime linha a linha)
-- ---------------------------------------------------------------------------
create table if not exists public.print_jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 80),
  lines jsonb not null check (jsonb_typeof(lines) = 'array' and jsonb_array_length(lines) between 1 and 600),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  printed_at timestamptz
);
create index if not exists print_jobs_pending_idx on public.print_jobs(created_at) where printed_at is null;
alter table public.print_jobs enable row level security;
revoke all on public.print_jobs from public, anon, authenticated;
grant select on public.print_jobs to authenticated;
drop policy if exists print_jobs_staff_read on public.print_jobs;
create policy print_jobs_staff_read on public.print_jobs for select to authenticated using (private.is_staff());

create or replace function public.staff_queue_print_job(requested_title text, requested_lines jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare job_id uuid;
begin
  if auth.uid() is null or not private.is_staff() then raise exception 'Acesso não autorizado'; end if;
  insert into public.print_jobs(title, lines) values (left(btrim(requested_title), 80), requested_lines) returning id into job_id;
  return job_id;
end; $$;
revoke all on function public.staff_queue_print_job(text, jsonb) from public, anon;
grant execute on function public.staff_queue_print_job(text, jsonb) to authenticated;

create or replace function public.staff_ack_print_job(target_job_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_staff() then raise exception 'Acesso não autorizado'; end if;
  update public.print_jobs set printed_at = coalesce(printed_at, now()) where id = target_job_id;
end; $$;
revoke all on function public.staff_ack_print_job(uuid) from public, anon;
grant execute on function public.staff_ack_print_job(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3a. Abertura: número do caixa e estoque inicial
-- ---------------------------------------------------------------------------
create or replace function private.staff_display_name(target_user_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select coalesce(nullif(p.nickname, ''), p.full_name) from public.staff_private_profiles p where p.user_id = target_user_id),
    'Equipe Adoce'
  );
$$;

create or replace function public.staff_open_cash_with_report(target_register_id uuid, next_opening_float numeric)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare opened jsonb; s public.cash_sessions%rowtype; r jsonb; service date;
begin
  opened := public.staff_open_cash_session(target_register_id, next_opening_float, 'Abertura pela tela Caixa');
  select * into s from public.cash_sessions where id = (opened->>'id')::uuid;
  service := (s.opened_at at time zone 'America/Fortaleza')::date;
  r := jsonb_build_object(
    'session', to_jsonb(s),
    'number', s.session_number,
    'store_name', (select name from public.stores where id = s.store_id),
    'register_name', (select name from public.cash_registers where id = s.register_id),
    'opened_by_name', private.staff_display_name(s.opened_by),
    'stock', coalesce((
      select jsonb_agg(jsonb_build_object('flavor_id', f.id, 'name', f.name, 'short_name', coalesce(nullif(f.short_name, ''), f.name), 'price', f.base_price, 'quantity', a.quantity_available) order by f.name)
      from public.flavor_availability a join public.flavors f on f.id = a.flavor_id
      where a.service_date = service and coalesce(a.quantity_available, 0) > 0
    ), '[]')
  );
  insert into public.cash_opening_reports(session_id, store_id, report) values (s.id, s.store_id, r);
  return r;
end; $$;

-- ---------------------------------------------------------------------------
-- 3b. Resumo de um caixa (usado no fechamento e no consolidado do dia)
-- ---------------------------------------------------------------------------
create or replace function private.cash_session_summary(target_session_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare s public.cash_sessions%rowtype; r jsonb;
begin
  select * into s from public.cash_sessions where id = target_session_id;
  if s.id is null then return null; end if;
  with orders as (
    select o.* from public.instant_orders o where o.cash_session_id = s.id
  ), done as (
    select * from orders where status = 'completed'
  ), items as (
    select i.*, f.base_price as table_price
    from public.instant_order_items i join done d on d.id = i.order_id
    left join public.flavors f on f.id = i.flavor_id
  ), moves as (
    select m.* from public.cash_movements m where m.cash_session_id = s.id
  ), pay as (
    select m.payment_method_code as method,
           sum(case when m.direction = 'in' then m.amount else -m.amount end) as amount,
           count(*) filter (where m.direction = 'in') as entries
    from moves m where m.kind in ('sale', 'refund') group by m.payment_method_code
  )
  select jsonb_build_object(
    'id', s.id,
    'number', s.session_number,
    'status', s.status,
    'opened_at', s.opened_at,
    'closed_at', s.closed_at,
    'opened_by_name', private.staff_display_name(s.opened_by),
    'closed_by_name', case when s.closed_by is null then null else private.staff_display_name(s.closed_by) end,
    'sales_count', (select count(*) from done),
    'table_value', (select coalesce(sum(coalesce(table_price, unit_price) * quantity), 0) from items),
    'discounts', (select coalesce(sum(discount_amount), 0) from done),
    'rewards_count', (select coalesce(sum(quantity), 0) from items where is_reward),
    'rewards_value', (select coalesce(sum(coalesce(table_price, unit_price) * quantity), 0) from items where is_reward),
    'revenue', (select coalesce(sum(total), 0) from done),
    'cancelled_count', (select count(*) from orders where status = 'cancelled'),
    'cancelled_value', (select coalesce(sum(total), 0) from orders where status = 'cancelled'),
    'slices_sold', (select coalesce(sum(quantity), 0) from items),
    'payments', coalesce((select jsonb_agg(jsonb_build_object('method', p.method, 'amount', p.amount, 'fee', round(p.amount * coalesce(pm.fee_percent, 0) / 100 + p.entries * coalesce(pm.fee_fixed, 0), 2)) order by p.method) from pay p left join public.payment_methods pm on pm.code = p.method), '[]'),
    'received', (select coalesce(sum(amount), 0) from pay),
    'fees', (select coalesce(sum(round(p.amount * coalesce(pm.fee_percent, 0) / 100 + p.entries * coalesce(pm.fee_fixed, 0), 2)), 0) from pay p left join public.payment_methods pm on pm.code = p.method),
    'drawer', jsonb_build_object(
      'opening_float', s.opening_float,
      'cash_sales', (select coalesce(sum(case when direction = 'in' then amount else -amount end), 0) from moves where kind in ('sale', 'refund') and payment_method_code = 'cash'),
      'supplies', (select coalesce(sum(amount), 0) from moves where kind in ('supply', 'adjustment_in') and payment_method_code = 'cash'),
      'withdrawals', (select coalesce(sum(amount), 0) from moves where kind in ('withdrawal', 'adjustment_out') and payment_method_code = 'cash'),
      'cash_expenses', (select coalesce(sum(amount), 0) from moves where kind = 'expense' and payment_method_code = 'cash'),
      'expected', coalesce(s.expected_cash, private.cash_expected_amount(s.id)),
      'counted', s.counted_cash,
      'difference', s.cash_difference
    ),
    'channels', coalesce((select jsonb_agg(jsonb_build_object('channel', coalesce(sales_channel, 'operation'), 'count', c) order by c desc) from (select sales_channel, count(*) c from done group by sales_channel) x), '[]'),
    'deferred_count', (select count(*) from orders where payment_deferred and payment_status <> 'approved'),
    'deferred_value', (select coalesce(sum(total - coalesce(amount_paid, 0)), 0) from orders where payment_deferred and payment_status <> 'approved'),
    'pix_change', (select coalesce(sum(change_pix_amount), 0) from done where coalesce(change_pix_amount, 0) > 0),
    'losses', (select coalesce(sum(quantity), 0) from public.slice_losses where session_id = s.id)
  ) into r;
  return r;
end; $$;

-- ---------------------------------------------------------------------------
-- 3c. Relatório de fechamento completo (mantém as chaves antigas)
-- ---------------------------------------------------------------------------
create or replace function public.staff_cash_closing_report(target_session_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.cash_sessions%rowtype; service date; opening jsonb; stock jsonb; day_sessions jsonb; day_count integer; summary jsonb;
begin
  select * into s from public.cash_sessions where id = target_session_id;
  if auth.uid() is null or not private.is_staff() or s.id is null or not private.can_access_store(s.store_id) then raise exception 'Acesso não autorizado'; end if;
  service := (s.opened_at at time zone 'America/Fortaleza')::date;
  select report into opening from public.cash_opening_reports where session_id = s.id;
  summary := private.cash_session_summary(s.id);

  -- Sabores: início (foto da abertura), vendidas no caixa, perdas e sobra atual.
  with base as (
    select f.id, f.name, coalesce(nullif(f.short_name, ''), f.name) as short_name, f.base_price
    from public.flavors f
  ), initial as (
    select (x->>'flavor_id')::uuid as flavor_id, (x->>'quantity')::int as quantity
    from jsonb_array_elements(coalesce(opening->'stock', '[]')) x
  ), sold as (
    select i.flavor_id, sum(i.quantity)::int as quantity, sum(i.quantity) filter (where i.is_reward)::int as rewards
    from public.instant_order_items i join public.instant_orders o on o.id = i.order_id
    where o.cash_session_id = s.id and o.status = 'completed' group by i.flavor_id
  ), lost as (
    select flavor_id, sum(quantity)::int as quantity from public.slice_losses where session_id = s.id group by flavor_id
  ), remaining as (
    select flavor_id, quantity_available as quantity from public.flavor_availability where service_date = service
  ), flavor_rows as (
    select b.id, b.name, b.short_name, b.base_price,
           coalesce(ini.quantity, 0) as initial, coalesce(so.quantity, 0) as sold, coalesce(so.rewards, 0) as rewards,
           coalesce(l.quantity, 0) as losses, coalesce(rem.quantity, 0) as remaining
    from base b
    left join initial ini on ini.flavor_id = b.id
    left join sold so on so.flavor_id = b.id
    left join lost l on l.flavor_id = b.id
    left join remaining rem on rem.flavor_id = b.id
    where coalesce(ini.quantity, 0) > 0 or coalesce(so.quantity, 0) > 0 or coalesce(l.quantity, 0) > 0
  )
  select coalesce(jsonb_agg(jsonb_build_object('name', name, 'short_name', short_name, 'price', base_price, 'initial', initial, 'sold', sold, 'rewards', rewards, 'losses', losses, 'remaining', remaining) order by sold desc, name), '[]')
  into stock from flavor_rows;

  -- Consolidado do dia: todos os caixas abertos no mesmo dia.
  select count(*), coalesce(jsonb_agg(private.cash_session_summary(x.id) order by x.opened_at), '[]')
  into day_count, day_sessions
  from public.cash_sessions x
  where x.store_id = s.store_id and (x.opened_at at time zone 'America/Fortaleza')::date = service;

  return jsonb_build_object(
    'session', to_jsonb(s) || jsonb_build_object('expected_cash', coalesce(s.expected_cash, private.cash_expected_amount(s.id))),
    'number', s.session_number,
    'service_date', service,
    'store_name', (select name from public.stores where id = s.store_id),
    'register_name', (select name from public.cash_registers where id = s.register_id),
    'summary', summary,
    'stock', stock,
    'stock_initial_known', opening is not null,
    'day', case when day_count >= 2 then jsonb_build_object('date', service, 'sessions', day_sessions) else null end,
    'expenses', coalesce((select jsonb_agg(jsonb_build_object('description', notes, 'method', payment_method_code, 'amount', amount) order by created_at) from public.cash_movements where cash_session_id = s.id and kind = 'expense'), '[]'),
    'pix_change', coalesce((select jsonb_agg(x) from (select coalesce(change_pix_source, 'Conta pessoal') source, sum(change_pix_amount) amount from public.instant_orders where cash_session_id = s.id and status = 'completed' and change_pix_amount > 0 group by change_pix_source) x), '[]'),
    'slices', coalesce((select jsonb_agg(x) from (select i.flavor_name name, sum(i.quantity) quantity from public.instant_order_items i join public.instant_orders o on o.id = i.order_id where o.cash_session_id = s.id and o.status = 'completed' group by i.flavor_name order by 2 desc, 1) x), '[]'),
    'payments', coalesce((select jsonb_agg(x) from (select payment_method_code method, sum(case when direction = 'in' then amount else -amount end) amount from public.cash_movements where cash_session_id = s.id and kind in ('sale', 'refund') group by payment_method_code) x), '[]'),
    'pending', coalesce((select jsonb_agg(x) from (select customer_name, order_number, total - amount_paid remaining from public.instant_orders where cash_session_id = s.id and payment_deferred and payment_status <> 'approved' order by created_at) x), '[]')
  );
end; $$;
revoke all on function public.staff_cash_closing_report(uuid) from public, anon;
grant execute on function public.staff_cash_closing_report(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Relatório de gestão por período (somente gerência)
-- ---------------------------------------------------------------------------
create or replace function public.manager_management_report(start_date date, end_date date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r jsonb; days integer; prev_start date; prev_end date;
begin
  if auth.uid() is null or not private.is_manager() then raise exception 'Acesso não autorizado'; end if;
  if start_date is null or end_date is null or end_date < start_date then raise exception 'Período inválido'; end if;
  if end_date - start_date > 400 then raise exception 'Escolha um período de até 400 dias'; end if;
  days := end_date - start_date + 1;
  prev_end := start_date - 1;
  prev_start := start_date - days;

  with orders as (
    select o.*, (coalesce(o.completed_at, o.created_at) at time zone 'America/Fortaleza') as local_at
    from public.instant_orders o
    where (coalesce(o.completed_at, o.created_at) at time zone 'America/Fortaleza')::date between prev_start and end_date
  ), cur as (
    select * from orders where local_at::date between start_date and end_date
  ), done as (
    select * from cur where status = 'completed'
  ), prev_done as (
    select * from orders where status = 'completed' and local_at::date between prev_start and prev_end
  ), items as (
    select i.*, f.base_price as table_price, c.unit_cost, d.local_at
    from public.instant_order_items i join done d on d.id = i.order_id
    left join public.flavors f on f.id = i.flavor_id
    left join public.flavor_costs c on c.flavor_id = i.flavor_id
  ), moves as (
    select m.* from public.cash_movements m
    where (m.created_at at time zone 'America/Fortaleza')::date between start_date and end_date
  ), pay_cash as (
    select payment_method_code as method, sum(case when direction = 'in' then amount else -amount end) as amount, count(*) filter (where direction = 'in') as entries
    from moves where kind in ('sale', 'refund') group by payment_method_code
  ), pay_site as (
    select coalesce(payment_method_code, 'pix') as method, sum(total) as amount, count(*) as entries
    from done where cash_session_id is null group by coalesce(payment_method_code, 'pix')
  ), pay as (
    select method, sum(amount) as amount, sum(entries) as entries from (select * from pay_cash union all select * from pay_site) u group by method
  ), losses as (
    select l.*, c.unit_cost from public.slice_losses l left join public.flavor_costs c on c.flavor_id = l.flavor_id
    where l.service_date between start_date and end_date
  )
  select jsonb_build_object(
    'period', jsonb_build_object('start', start_date, 'end', end_date, 'days', days, 'previous_start', prev_start, 'previous_end', prev_end),
    'kpis', jsonb_build_object(
      'revenue', (select coalesce(sum(total), 0) from done),
      'previous_revenue', (select coalesce(sum(total), 0) from prev_done),
      'sales_count', (select count(*) from done),
      'previous_sales_count', (select count(*) from prev_done),
      'slices_sold', (select coalesce(sum(quantity), 0) from items),
      'rewards_count', (select coalesce(sum(quantity), 0) from items where is_reward),
      'losses', (select coalesce(sum(quantity), 0) from losses),
      'fees', (select coalesce(sum(round(p.amount * coalesce(pm.fee_percent, 0) / 100 + p.entries * coalesce(pm.fee_fixed, 0), 2)), 0) from pay p left join public.payment_methods pm on pm.code = p.method),
      'cash_difference', (select coalesce(sum(cash_difference), 0) from public.cash_sessions where status = 'closed' and (closed_at at time zone 'America/Fortaleza')::date between start_date and end_date),
      'deferred_open', (select coalesce(sum(total - coalesce(amount_paid, 0)), 0) from public.instant_orders where payment_deferred and payment_status <> 'approved' and status <> 'cancelled')
    ),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('date', d::date, 'revenue', coalesce(x.revenue, 0), 'count', coalesce(x.count, 0)) order by d)
      from generate_series(start_date, end_date, interval '1 day') d
      left join (select local_at::date as day, sum(total) revenue, count(*) count from done group by 1) x on x.day = d::date), '[]'),
    'hourly', coalesce((select jsonb_agg(jsonb_build_object('hour', h, 'count', coalesce(x.count, 0)) order by h)
      from generate_series(0, 23) h
      left join (select extract(hour from local_at)::int as hour, count(*) count from done group by 1) x on x.hour = h), '[]'),
    'payments', coalesce((select jsonb_agg(jsonb_build_object('method', p.method, 'label', coalesce(pm.label, p.method), 'amount', p.amount,
        'fee', round(p.amount * coalesce(pm.fee_percent, 0) / 100 + p.entries * coalesce(pm.fee_fixed, 0), 2)) order by p.amount desc)
      from pay p left join public.payment_methods pm on pm.code = p.method), '[]'),
    'flavors', coalesce((select jsonb_agg(x order by x.sold desc, x.name) from (
        select coalesce(i.flavor_name, 'Sem sabor') as name, sum(i.quantity)::int as sold, sum(i.quantity) filter (where i.is_reward)::int as rewards,
               sum(case when i.is_reward then 0 else i.unit_price * i.quantity end) as revenue,
               max(i.unit_cost) as unit_cost,
               sum(i.quantity * i.unit_cost) as cost
        from items i group by coalesce(i.flavor_name, 'Sem sabor')) x), '[]'),
    'channels', coalesce((select jsonb_agg(jsonb_build_object('channel', coalesce(sales_channel, 'operation'), 'count', c, 'revenue', v) order by v desc)
      from (select sales_channel, count(*) c, sum(total) v from done group by sales_channel) x), '[]'),
    'sessions', coalesce((select jsonb_agg(private.cash_session_summary(s.id) order by s.opened_at desc)
      from public.cash_sessions s where (s.opened_at at time zone 'America/Fortaleza')::date between start_date and end_date), '[]'),
    'expenses', coalesce((select jsonb_agg(jsonb_build_object('date', m.created_at, 'kind', m.kind, 'method', m.payment_method_code, 'amount', m.amount, 'notes', m.notes) order by m.created_at desc)
      from moves m where m.kind in ('expense', 'withdrawal', 'supply')), '[]'),
    'receivables', coalesce((select jsonb_agg(jsonb_build_object('order_number', o.order_number, 'customer_name', o.customer_name, 'remaining', o.total - coalesce(o.amount_paid, 0), 'created_at', o.created_at,
        'days', ((now() at time zone 'America/Fortaleza')::date - (o.created_at at time zone 'America/Fortaleza')::date)) order by o.created_at)
      from public.instant_orders o where o.payment_deferred and o.payment_status <> 'approved' and o.status <> 'cancelled'), '[]'),
    'losses', coalesce((select jsonb_agg(jsonb_build_object('name', f.name, 'quantity', x.quantity, 'cost', x.cost) order by x.quantity desc)
      from (select flavor_id, sum(quantity)::int quantity, sum(quantity * unit_cost) cost from losses group by flavor_id) x join public.flavors f on f.id = x.flavor_id), '[]'),
    'adjustments', jsonb_build_object(
      'discounts', (select coalesce(sum(discount_amount), 0) from done),
      'rewards_value', (select coalesce(sum(coalesce(table_price, unit_price) * quantity), 0) from items where is_reward),
      'cancelled_count', (select count(*) from cur where status = 'cancelled'),
      'cancelled_value', (select coalesce(sum(total), 0) from cur where status = 'cancelled')
    ),
    'dre', jsonb_build_object(
      'table_value', (select coalesce(sum(coalesce(table_price, unit_price) * quantity), 0) from items),
      'discounts', (select coalesce(sum(discount_amount), 0) from done),
      'rewards_value', (select coalesce(sum(coalesce(table_price, unit_price) * quantity), 0) from items where is_reward),
      'revenue', (select coalesce(sum(total), 0) from done),
      'fees', (select coalesce(sum(round(p.amount * coalesce(pm.fee_percent, 0) / 100 + p.entries * coalesce(pm.fee_fixed, 0), 2)), 0) from pay p left join public.payment_methods pm on pm.code = p.method),
      'cogs', (select coalesce(sum(quantity * unit_cost), 0) from items where unit_cost is not null),
      'cogs_coverage', (select case when coalesce(sum(quantity), 0) = 0 then 0 else round(100.0 * coalesce(sum(quantity) filter (where unit_cost is not null), 0) / sum(quantity), 1) end from items),
      'losses_cost', (select coalesce(sum(quantity * unit_cost), 0) from losses where unit_cost is not null),
      'expenses', (select coalesce(sum(amount), 0) from moves where kind = 'expense')
    )
  ) into r;
  return r;
end; $$;
revoke all on function public.manager_management_report(date, date) from public, anon;
grant execute on function public.manager_management_report(date, date) to authenticated;
