begin;

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(btrim(name)) between 2 and 100),
  public_label text not null default '',
  address_text text not null default '',
  timezone text not null default 'America/Fortaleza',
  pickup_location_id uuid references public.pickup_locations(id) on delete set null,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cash_registers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  code text not null check (code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  device_label text not null default '',
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, code)
);

create table if not exists public.staff_store_assignments (
  staff_user_id uuid not null references public.staff_members(user_id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  active boolean not null default true,
  can_sell boolean not null default true,
  can_open_cash boolean not null default false,
  can_close_cash boolean not null default false,
  can_manage_stock boolean not null default false,
  can_view_finance boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (staff_user_id, store_id)
);

create table if not exists public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  register_id uuid not null references public.cash_registers(id) on delete restrict,
  status text not null default 'open' check (status in ('open', 'closed', 'cancelled')),
  opened_by uuid not null references auth.users(id) on delete restrict,
  opened_at timestamptz not null default now(),
  opening_float numeric(12,2) not null default 0 check (opening_float >= 0),
  opening_notes text not null default '',
  closed_by uuid references auth.users(id) on delete restrict,
  closed_at timestamptz,
  expected_cash numeric(12,2),
  counted_cash numeric(12,2),
  cash_difference numeric(12,2),
  closing_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'open' and closed_at is null)
    or (status in ('closed', 'cancelled') and closed_at is not null)
  )
);

create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  cash_session_id uuid not null references public.cash_sessions(id) on delete restrict,
  store_id uuid not null references public.stores(id) on delete restrict,
  register_id uuid not null references public.cash_registers(id) on delete restrict,
  kind text not null check (kind in ('sale', 'supply', 'withdrawal', 'refund', 'expense', 'adjustment_in', 'adjustment_out')),
  direction text not null check (direction in ('in', 'out')),
  payment_method_code text references public.payment_methods(code) on update cascade on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  order_id uuid references public.instant_orders(id) on delete set null,
  notes text not null default '',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.instant_orders
  add column if not exists store_id uuid references public.stores(id) on delete set null,
  add column if not exists cash_register_id uuid references public.cash_registers(id) on delete set null,
  add column if not exists cash_session_id uuid references public.cash_sessions(id) on delete set null;

create unique index if not exists cash_sessions_one_open_per_register
  on public.cash_sessions(register_id)
  where status = 'open';
create index if not exists cash_sessions_store_status_idx on public.cash_sessions(store_id, status, opened_at desc);
create index if not exists cash_movements_session_created_idx on public.cash_movements(cash_session_id, created_at desc);
create index if not exists cash_movements_store_created_idx on public.cash_movements(store_id, created_at desc);
create index if not exists staff_store_assignments_store_idx on public.staff_store_assignments(store_id, active);

create or replace function private.current_staff_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.role::text
  from public.staff_members s
  where s.user_id = (select auth.uid()) and s.active
  limit 1;
$$;

create or replace function private.can_access_store(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_manager()
    or exists (
      select 1
      from public.staff_store_assignments a
      where a.staff_user_id = (select auth.uid())
        and a.store_id = target_store_id
        and a.active
    );
$$;

create or replace function private.can_sell_at_store(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_manager()
    or exists (
      select 1
      from public.staff_store_assignments a
      where a.staff_user_id = (select auth.uid())
        and a.store_id = target_store_id
        and a.active
        and a.can_sell
    );
$$;

create or replace function private.can_open_cash_at_store(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_manager()
    or exists (
      select 1
      from public.staff_store_assignments a
      where a.staff_user_id = (select auth.uid())
        and a.store_id = target_store_id
        and a.active
        and a.can_open_cash
    );
$$;

create or replace function private.can_close_cash_at_store(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_manager()
    or exists (
      select 1
      from public.staff_store_assignments a
      where a.staff_user_id = (select auth.uid())
        and a.store_id = target_store_id
        and a.active
        and a.can_close_cash
    );
$$;

create or replace function private.cash_expected_amount(target_session_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select round(
    s.opening_float
    + coalesce(sum(
        case
          when m.payment_method_code = 'cash' and m.direction = 'in' then m.amount
          when m.payment_method_code = 'cash' and m.direction = 'out' then -m.amount
          else 0
        end
      ), 0),
    2
  )
  from public.cash_sessions s
  left join public.cash_movements m on m.cash_session_id = s.id
  where s.id = target_session_id
  group by s.id, s.opening_float;
$$;

create or replace function public.staff_get_business_workspace()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_role text;
begin
  if (select auth.uid()) is null or not private.is_staff() then
    raise exception 'Acesso nao autorizado';
  end if;
  current_role := private.current_staff_role();
  return jsonb_build_object(
    'role', current_role,
    'stores', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.name)
      from public.stores s
      where private.can_access_store(s.id)
    ), '[]'::jsonb),
    'registers', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.name)
      from public.cash_registers r
      where private.can_access_store(r.store_id)
    ), '[]'::jsonb),
    'assignments', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.store_id, a.staff_user_id)
      from public.staff_store_assignments a
      where private.is_manager() or a.staff_user_id = (select auth.uid())
    ), '[]'::jsonb),
    'staff', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', s.user_id,
        'role', s.role::text,
        'active', s.active,
        'display_name', coalesce(p.full_name, 'Membro da equipe'),
        'phone_e164', p.phone_e164
      ) order by coalesce(p.full_name, ''))
      from public.staff_members s
      left join public.profiles p on p.id = s.user_id
      where private.is_manager() or s.user_id = (select auth.uid())
    ), '[]'::jsonb),
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', cs.id,
        'store_id', cs.store_id,
        'register_id', cs.register_id,
        'status', cs.status,
        'opened_by', cs.opened_by,
        'opened_at', cs.opened_at,
        'opening_float', cs.opening_float,
        'opening_notes', cs.opening_notes,
        'closed_by', cs.closed_by,
        'closed_at', cs.closed_at,
        'expected_cash', coalesce(cs.expected_cash, private.cash_expected_amount(cs.id)),
        'counted_cash', cs.counted_cash,
        'cash_difference', cs.cash_difference,
        'closing_notes', cs.closing_notes
      ) order by cs.opened_at desc)
      from public.cash_sessions cs
      where private.can_access_store(cs.store_id)
        and cs.opened_at >= now() - interval '45 days'
    ), '[]'::jsonb),
    'movements', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.created_at desc)
      from (
        select cm.*
        from public.cash_movements cm
        where private.can_access_store(cm.store_id)
        order by cm.created_at desc
        limit 150
      ) m
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.manager_upsert_store(
  target_store_id uuid,
  next_name text,
  next_slug text,
  next_public_label text,
  next_address_text text,
  next_pickup_location_id uuid,
  next_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare target public.stores%rowtype;
begin
  if not private.is_manager() then raise exception 'Apenas gestores podem administrar lojas'; end if;
  if char_length(btrim(coalesce(next_name, ''))) < 2 then raise exception 'Informe o nome da loja'; end if;
  if coalesce(next_slug, '') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then raise exception 'Use um identificador simples para a loja'; end if;
  if target_store_id is null then
    insert into public.stores(slug, name, public_label, address_text, pickup_location_id, active, created_by, updated_by)
    values (next_slug, btrim(next_name), btrim(coalesce(next_public_label, '')), btrim(coalesce(next_address_text, '')), next_pickup_location_id, coalesce(next_active, true), (select auth.uid()), (select auth.uid()))
    returning * into target;
  else
    update public.stores
    set slug = next_slug,
        name = btrim(next_name),
        public_label = btrim(coalesce(next_public_label, '')),
        address_text = btrim(coalesce(next_address_text, '')),
        pickup_location_id = next_pickup_location_id,
        active = coalesce(next_active, true),
        updated_by = (select auth.uid()),
        updated_at = now()
    where id = target_store_id
    returning * into target;
  end if;
  if target.id is null then raise exception 'Loja nao encontrada'; end if;
  return to_jsonb(target);
end;
$$;

create or replace function public.manager_upsert_cash_register(
  target_register_id uuid,
  target_store_id uuid,
  next_name text,
  next_code text,
  next_device_label text,
  next_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare target public.cash_registers%rowtype;
begin
  if not private.is_manager() then raise exception 'Apenas gestores podem administrar caixas'; end if;
  if not exists(select 1 from public.stores s where s.id = target_store_id) then raise exception 'Loja nao encontrada'; end if;
  if char_length(btrim(coalesce(next_name, ''))) < 2 then raise exception 'Informe o nome do caixa'; end if;
  if coalesce(next_code, '') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then raise exception 'Use um codigo simples para o caixa'; end if;
  if target_register_id is null then
    insert into public.cash_registers(store_id, code, name, device_label, active, created_by, updated_by)
    values (target_store_id, next_code, btrim(next_name), btrim(coalesce(next_device_label, '')), coalesce(next_active, true), (select auth.uid()), (select auth.uid()))
    returning * into target;
  else
    update public.cash_registers
    set store_id = target_store_id,
        code = next_code,
        name = btrim(next_name),
        device_label = btrim(coalesce(next_device_label, '')),
        active = coalesce(next_active, true),
        updated_by = (select auth.uid()),
        updated_at = now()
    where id = target_register_id
    returning * into target;
  end if;
  if target.id is null then raise exception 'Caixa nao encontrado'; end if;
  return to_jsonb(target);
end;
$$;

create or replace function public.manager_set_staff_store_assignment(
  target_user_id uuid,
  target_store_id uuid,
  next_active boolean,
  next_can_sell boolean,
  next_can_open_cash boolean,
  next_can_close_cash boolean,
  next_can_manage_stock boolean,
  next_can_view_finance boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare target public.staff_store_assignments%rowtype;
begin
  if not private.is_manager() then raise exception 'Apenas gestores podem administrar permissoes'; end if;
  if not exists(select 1 from public.staff_members s where s.user_id = target_user_id) then raise exception 'Membro da equipe nao encontrado'; end if;
  if not exists(select 1 from public.stores s where s.id = target_store_id) then raise exception 'Loja nao encontrada'; end if;
  insert into public.staff_store_assignments(
    staff_user_id, store_id, active, can_sell, can_open_cash, can_close_cash,
    can_manage_stock, can_view_finance, created_by, updated_by
  ) values (
    target_user_id, target_store_id, coalesce(next_active, true), coalesce(next_can_sell, false),
    coalesce(next_can_open_cash, false), coalesce(next_can_close_cash, false),
    coalesce(next_can_manage_stock, false), coalesce(next_can_view_finance, false),
    (select auth.uid()), (select auth.uid())
  )
  on conflict (staff_user_id, store_id) do update
  set active = excluded.active,
      can_sell = excluded.can_sell,
      can_open_cash = excluded.can_open_cash,
      can_close_cash = excluded.can_close_cash,
      can_manage_stock = excluded.can_manage_stock,
      can_view_finance = excluded.can_view_finance,
      updated_by = (select auth.uid()),
      updated_at = now()
  returning * into target;
  return to_jsonb(target);
end;
$$;

create or replace function public.manager_update_staff_member(
  target_user_id uuid,
  next_role text,
  next_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare current_role text; target public.staff_members%rowtype;
begin
  if not private.is_manager() then raise exception 'Apenas gestores podem administrar a equipe'; end if;
  if next_role not in ('owner', 'manager', 'attendant', 'viewer') then raise exception 'Funcao invalida'; end if;
  select role::text into current_role from public.staff_members where user_id = target_user_id;
  if current_role is null then raise exception 'Membro da equipe nao encontrado'; end if;
  if not private.is_owner() and (current_role in ('owner', 'manager') or next_role in ('owner', 'manager')) then
    raise exception 'Somente o proprietario pode alterar proprietarios e gerentes';
  end if;
  if target_user_id = (select auth.uid()) and not coalesce(next_active, true) then
    raise exception 'Voce nao pode desativar o proprio acesso';
  end if;
  update public.staff_members
  set role = next_role::public.staff_role,
      active = coalesce(next_active, true)
  where user_id = target_user_id
  returning * into target;
  return to_jsonb(target);
end;
$$;

create or replace function public.staff_open_cash_session(
  target_register_id uuid,
  next_opening_float numeric,
  next_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare register_record public.cash_registers%rowtype; target public.cash_sessions%rowtype;
begin
  if (select auth.uid()) is null or not private.is_staff() then raise exception 'Acesso nao autorizado'; end if;
  select r.* into register_record
  from public.cash_registers r
  join public.stores s on s.id = r.store_id
  where r.id = target_register_id and r.active and s.active;
  if register_record.id is null then raise exception 'Caixa ativo nao encontrado'; end if;
  if not private.can_open_cash_at_store(register_record.store_id) then raise exception 'Voce nao possui permissao para abrir este caixa'; end if;
  if coalesce(next_opening_float, 0) < 0 then raise exception 'O valor inicial nao pode ser negativo'; end if;
  insert into public.cash_sessions(store_id, register_id, opened_by, opening_float, opening_notes)
  values (register_record.store_id, register_record.id, (select auth.uid()), round(coalesce(next_opening_float, 0), 2), left(coalesce(next_notes, ''), 1000))
  returning * into target;
  return to_jsonb(target);
exception when unique_violation then
  raise exception 'Este caixa ja possui uma abertura em andamento';
end;
$$;

create or replace function public.staff_record_cash_movement(
  target_session_id uuid,
  movement_kind text,
  requested_payment_method text,
  requested_amount numeric,
  next_notes text default '',
  target_order_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare session_record public.cash_sessions%rowtype; target public.cash_movements%rowtype; movement_direction text; payment_code text;
begin
  if (select auth.uid()) is null or not private.is_staff() then raise exception 'Acesso nao autorizado'; end if;
  select * into session_record from public.cash_sessions where id = target_session_id and status = 'open';
  if session_record.id is null then raise exception 'O caixa nao esta aberto'; end if;
  if movement_kind not in ('sale', 'supply', 'withdrawal', 'refund', 'expense', 'adjustment_in', 'adjustment_out') then raise exception 'Tipo de movimentacao invalido'; end if;
  if coalesce(requested_amount, 0) <= 0 then raise exception 'Informe um valor maior que zero'; end if;
  if movement_kind = 'sale' and not private.can_sell_at_store(session_record.store_id) then raise exception 'Voce nao possui permissao para vender nesta loja'; end if;
  if movement_kind in ('supply', 'withdrawal') and not (private.can_open_cash_at_store(session_record.store_id) or private.can_close_cash_at_store(session_record.store_id)) then raise exception 'Voce nao possui permissao para movimentar dinheiro neste caixa'; end if;
  if movement_kind in ('refund', 'expense', 'adjustment_in', 'adjustment_out') and not private.is_manager() then raise exception 'Esta movimentacao exige acesso de gestor'; end if;
  movement_direction := case when movement_kind in ('sale', 'supply', 'adjustment_in') then 'in' else 'out' end;
  payment_code := case
    when movement_kind in ('supply', 'withdrawal', 'expense', 'adjustment_in', 'adjustment_out') then 'cash'
    else coalesce(nullif(requested_payment_method, ''), 'cash')
  end;
  if movement_kind in ('sale', 'refund') and not exists(select 1 from public.payment_methods p where p.code = payment_code and p.active) then
    raise exception 'Meio de pagamento indisponivel';
  end if;
  insert into public.cash_movements(
    cash_session_id, store_id, register_id, kind, direction, payment_method_code,
    amount, order_id, notes, created_by
  ) values (
    session_record.id, session_record.store_id, session_record.register_id, movement_kind,
    movement_direction, payment_code, round(requested_amount, 2), target_order_id,
    left(coalesce(next_notes, ''), 1000), (select auth.uid())
  ) returning * into target;
  if target_order_id is not null then
    update public.instant_orders
    set store_id = session_record.store_id,
        cash_register_id = session_record.register_id,
        cash_session_id = session_record.id,
        updated_by = (select auth.uid()),
        updated_at = now()
    where id = target_order_id;
  end if;
  return to_jsonb(target);
end;
$$;

create or replace function public.staff_close_cash_session(
  target_session_id uuid,
  next_counted_cash numeric,
  next_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare session_record public.cash_sessions%rowtype; expected numeric; target public.cash_sessions%rowtype;
begin
  if (select auth.uid()) is null or not private.is_staff() then raise exception 'Acesso nao autorizado'; end if;
  select * into session_record from public.cash_sessions where id = target_session_id and status = 'open' for update;
  if session_record.id is null then raise exception 'O caixa nao esta aberto'; end if;
  if not private.can_close_cash_at_store(session_record.store_id) then raise exception 'Voce nao possui permissao para fechar este caixa'; end if;
  if coalesce(next_counted_cash, -1) < 0 then raise exception 'Informe o valor contado no caixa'; end if;
  expected := private.cash_expected_amount(session_record.id);
  update public.cash_sessions
  set status = 'closed',
      closed_by = (select auth.uid()),
      closed_at = now(),
      expected_cash = expected,
      counted_cash = round(next_counted_cash, 2),
      cash_difference = round(next_counted_cash - expected, 2),
      closing_notes = left(coalesce(next_notes, ''), 1000),
      updated_at = now()
  where id = session_record.id
  returning * into target;
  return to_jsonb(target);
end;
$$;

create or replace function public.manager_cancel_empty_cash_session(
  target_session_id uuid,
  next_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare target public.cash_sessions%rowtype;
begin
  if not private.is_manager() then raise exception 'Apenas gestores podem cancelar uma abertura'; end if;
  if exists(select 1 from public.cash_movements where cash_session_id = target_session_id) then raise exception 'Caixas com movimentacao devem ser fechados, nao cancelados'; end if;
  update public.cash_sessions
  set status = 'cancelled',
      closed_by = (select auth.uid()),
      closed_at = now(),
      expected_cash = opening_float,
      counted_cash = opening_float,
      cash_difference = 0,
      closing_notes = left(coalesce(next_notes, ''), 1000),
      updated_at = now()
  where id = target_session_id and status = 'open'
  returning * into target;
  if target.id is null then raise exception 'Abertura nao encontrada'; end if;
  return to_jsonb(target);
end;
$$;

alter table public.stores enable row level security;
alter table public.cash_registers enable row level security;
alter table public.staff_store_assignments enable row level security;
alter table public.cash_sessions enable row level security;
alter table public.cash_movements enable row level security;

drop policy if exists stores_staff_read on public.stores;
create policy stores_staff_read on public.stores for select to authenticated using (private.can_access_store(id));
drop policy if exists stores_manager_insert on public.stores;
create policy stores_manager_insert on public.stores for insert to authenticated with check (private.is_manager());
drop policy if exists stores_manager_update on public.stores;
create policy stores_manager_update on public.stores for update to authenticated using (private.is_manager()) with check (private.is_manager());

drop policy if exists cash_registers_staff_read on public.cash_registers;
create policy cash_registers_staff_read on public.cash_registers for select to authenticated using (private.can_access_store(store_id));
drop policy if exists cash_registers_manager_insert on public.cash_registers;
create policy cash_registers_manager_insert on public.cash_registers for insert to authenticated with check (private.is_manager());
drop policy if exists cash_registers_manager_update on public.cash_registers;
create policy cash_registers_manager_update on public.cash_registers for update to authenticated using (private.is_manager()) with check (private.is_manager());

drop policy if exists staff_store_assignments_read on public.staff_store_assignments;
create policy staff_store_assignments_read on public.staff_store_assignments for select to authenticated using (private.is_manager() or staff_user_id = (select auth.uid()));
drop policy if exists staff_store_assignments_manager_all on public.staff_store_assignments;
create policy staff_store_assignments_manager_all on public.staff_store_assignments for all to authenticated using (private.is_manager()) with check (private.is_manager());

drop policy if exists cash_sessions_staff_read on public.cash_sessions;
create policy cash_sessions_staff_read on public.cash_sessions for select to authenticated using (private.can_access_store(store_id));
drop policy if exists cash_movements_staff_read on public.cash_movements;
create policy cash_movements_staff_read on public.cash_movements for select to authenticated using (private.can_access_store(store_id));

drop trigger if exists stores_touch_updated_at on public.stores;
create trigger stores_touch_updated_at before update on public.stores for each row execute function private.touch_updated_at();
drop trigger if exists cash_registers_touch_updated_at on public.cash_registers;
create trigger cash_registers_touch_updated_at before update on public.cash_registers for each row execute function private.touch_updated_at();
drop trigger if exists staff_store_assignments_touch_updated_at on public.staff_store_assignments;
create trigger staff_store_assignments_touch_updated_at before update on public.staff_store_assignments for each row execute function private.touch_updated_at();
drop trigger if exists cash_sessions_touch_updated_at on public.cash_sessions;
create trigger cash_sessions_touch_updated_at before update on public.cash_sessions for each row execute function private.touch_updated_at();

insert into public.stores(slug, name, public_label, address_text, pickup_location_id)
select
  'passare',
  coalesce(nullif(name, ''), 'Adoce Passare'),
  coalesce(nullif(public_label, ''), 'Adoce Passare'),
  coalesce(address_text, ''),
  id
from public.pickup_locations
where active
order by sort_order, created_at
limit 1
on conflict (slug) do nothing;

insert into public.stores(slug, name, public_label, address_text)
select 'passare', 'Adoce Passare', 'Adoce Passare', ''
where not exists(select 1 from public.stores)
on conflict (slug) do nothing;

insert into public.cash_registers(store_id, code, name, device_label)
select s.id, 'principal', 'Caixa principal', 'Tablet ou computador principal'
from public.stores s
where s.slug = 'passare'
on conflict (store_id, code) do nothing;

revoke all on function public.staff_get_business_workspace() from public;
revoke all on function public.manager_upsert_store(uuid,text,text,text,text,uuid,boolean) from public;
revoke all on function public.manager_upsert_cash_register(uuid,uuid,text,text,text,boolean) from public;
revoke all on function public.manager_set_staff_store_assignment(uuid,uuid,boolean,boolean,boolean,boolean,boolean,boolean) from public;
revoke all on function public.manager_update_staff_member(uuid,text,boolean) from public;
revoke all on function public.staff_open_cash_session(uuid,numeric,text) from public;
revoke all on function public.staff_record_cash_movement(uuid,text,text,numeric,text,uuid) from public;
revoke all on function public.staff_close_cash_session(uuid,numeric,text) from public;
revoke all on function public.manager_cancel_empty_cash_session(uuid,text) from public;

grant execute on function public.staff_get_business_workspace() to authenticated;
grant execute on function public.manager_upsert_store(uuid,text,text,text,text,uuid,boolean) to authenticated;
grant execute on function public.manager_upsert_cash_register(uuid,uuid,text,text,text,boolean) to authenticated;
grant execute on function public.manager_set_staff_store_assignment(uuid,uuid,boolean,boolean,boolean,boolean,boolean,boolean) to authenticated;
grant execute on function public.manager_update_staff_member(uuid,text,boolean) to authenticated;
grant execute on function public.staff_open_cash_session(uuid,numeric,text) to authenticated;
grant execute on function public.staff_record_cash_movement(uuid,text,text,numeric,text,uuid) to authenticated;
grant execute on function public.staff_close_cash_session(uuid,numeric,text) to authenticated;
grant execute on function public.manager_cancel_empty_cash_session(uuid,text) to authenticated;

grant select on public.stores, public.cash_registers, public.staff_store_assignments, public.cash_sessions, public.cash_movements to authenticated;

commit;
