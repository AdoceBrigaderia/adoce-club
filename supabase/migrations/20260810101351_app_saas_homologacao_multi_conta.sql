-- ============================================================
-- HOMOLOGAÇÃO do produto genérico (multi-cliente).
-- Prefixo app_. Não tem relação com as tabelas da operação Adoce
-- nem com as fin_* (financeiro pessoal do Rubens e da Beth).
-- ============================================================

-- ---------- CONTA (o cliente que assina) ----------
create table if not exists public.app_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  -- personalização individual
  brand_color text not null default '#2563eb',
  logo_url text,
  currency text not null default 'BRL',
  locale text not null default 'pt-BR',
  week_start smallint not null default 1 check (week_start in (0,1)),
  date_adjust text not null default 'next_business' check (date_adjust in ('none','next_business','prev_business')),
  initial_balance numeric(14,2) not null default 0,
  -- assinatura
  plan text not null default 'trial' check (plan in ('trial','basico','pro','ilimitado')),
  status text not null default 'trialing' check (status in ('trialing','active','past_due','canceled')),
  trial_ends_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- MEMBROS E PERMISSÕES ----------
create table if not exists public.app_members (
  account_id uuid not null references public.app_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner','admin','editor','viewer')),
  display_name text not null default '',
  created_at timestamptz not null default now(),
  primary key (account_id, user_id)
);
create index if not exists app_members_user_idx on public.app_members(user_id);

create table if not exists public.app_invites (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.app_accounts(id) on delete cascade,
  email text not null,
  role text not null default 'editor' check (role in ('owner','admin','editor','viewer')),
  token text not null unique default encode(gen_random_bytes(24),'hex'),
  invited_by uuid references auth.users(id),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- FUNÇÕES DE ACESSO ----------
create or replace function public.app_is_member(acc uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (select 1 from public.app_members m where m.account_id=acc and m.user_id=auth.uid());
$$;

create or replace function public.app_can_write(acc uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (select 1 from public.app_members m
                 where m.account_id=acc and m.user_id=auth.uid()
                   and m.role in ('owner','admin','editor'));
$$;

create or replace function public.app_is_admin(acc uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (select 1 from public.app_members m
                 where m.account_id=acc and m.user_id=auth.uid()
                   and m.role in ('owner','admin'));
$$;

-- ---------- CENTROS (o cliente renomeia "Empresa/Pessoal") ----------
create table if not exists public.app_centers (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.app_accounts(id) on delete cascade,
  name text not null,
  color text not null default '#64748b',
  sort_order int not null default 0,
  archived boolean not null default false,
  unique (account_id, name)
);

-- ---------- CATEGORIAS ----------
create table if not exists public.app_categories (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.app_accounts(id) on delete cascade,
  type text not null check (type in ('Receita','Despesa')),
  name text not null,
  color text,
  sort_order int not null default 0,
  archived boolean not null default false,
  unique (account_id, type, name)
);

-- ---------- RECORRÊNCIAS ----------
create table if not exists public.app_series (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.app_accounts(id) on delete cascade,
  description text not null default '',
  freq text not null check (freq in ('weekly','biweekly','monthly','monthly_nth','n_months','yearly')),
  interval_n int not null default 1,
  weekday smallint,
  month_day int,
  nth int,
  adjust text not null default 'next_business',
  occurrences int,
  start_date date not null,
  end_date date,
  active boolean not null default true,
  template jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists app_series_account_idx on public.app_series(account_id);

-- ---------- LANÇAMENTOS ----------
create table if not exists public.app_entries (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.app_accounts(id) on delete cascade,
  type text not null check (type in ('Receita','Despesa')),
  status text not null default 'Previsto' check (status in ('Previsto','Realizado')),
  center_id uuid references public.app_centers(id) on delete set null,
  category_id uuid references public.app_categories(id) on delete set null,
  description text not null,
  value numeric(14,2) not null check (value >= 0),
  date date not null,
  notes text not null default '',
  series_id uuid references public.app_series(id) on delete set null,
  occurrence_index int,
  occurrence_total int,
  paid_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists app_entries_account_date_idx on public.app_entries(account_id, date);
create index if not exists app_entries_status_idx on public.app_entries(account_id, status);
create index if not exists app_entries_series_idx on public.app_entries(series_id);

-- ---------- ASSINATURA ----------
create table if not exists public.app_subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.app_accounts(id) on delete cascade,
  provider text not null default 'manual',
  external_id text,
  plan text not null,
  status text not null,
  amount numeric(10,2),
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- MOTOR DE DATAS (genérico, por conta) ----------
create or replace function public.app_adjust_date(d date, modo text default 'next_business')
returns date language plpgsql immutable as $$
declare fim date := (date_trunc('month', d) + interval '1 month - 1 day')::date; r date := d;
begin
  if modo = 'none' then return d; end if;
  if modo = 'prev_business' then
    while extract(isodow from r) in (6,7) loop r := r - 1; end loop;
    return r;
  end if;
  if extract(isodow from r) = 6 then r := r + 2;
  elsif extract(isodow from r) = 7 then r := r + 1; end if;
  if r > fim then
    r := d;
    while extract(isodow from r) in (6,7) loop r := r - 1; end loop;
  end if;
  return r;
end $$;

-- ---------- RLS ----------
alter table public.app_accounts      enable row level security;
alter table public.app_members       enable row level security;
alter table public.app_invites       enable row level security;
alter table public.app_centers       enable row level security;
alter table public.app_categories    enable row level security;
alter table public.app_series        enable row level security;
alter table public.app_entries       enable row level security;
alter table public.app_subscriptions enable row level security;

drop policy if exists app_accounts_read on public.app_accounts;
create policy app_accounts_read on public.app_accounts
  for select to authenticated using (public.app_is_member(id));
drop policy if exists app_accounts_write on public.app_accounts;
create policy app_accounts_write on public.app_accounts
  for update to authenticated using (public.app_is_admin(id)) with check (public.app_is_admin(id));

drop policy if exists app_members_read on public.app_members;
create policy app_members_read on public.app_members
  for select to authenticated using (public.app_is_member(account_id));
drop policy if exists app_members_manage on public.app_members;
create policy app_members_manage on public.app_members
  for all to authenticated using (public.app_is_admin(account_id)) with check (public.app_is_admin(account_id));

drop policy if exists app_invites_manage on public.app_invites;
create policy app_invites_manage on public.app_invites
  for all to authenticated using (public.app_is_admin(account_id)) with check (public.app_is_admin(account_id));

drop policy if exists app_subs_read on public.app_subscriptions;
create policy app_subs_read on public.app_subscriptions
  for select to authenticated using (public.app_is_admin(account_id));

-- dados operacionais: ler quem é membro, escrever quem tem permissão
do $$
declare t text;
begin
  foreach t in array array['app_centers','app_categories','app_series','app_entries'] loop
    execute format('drop policy if exists %I on public.%I', t||'_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.app_is_member(account_id))', t||'_read', t);
    execute format('drop policy if exists %I on public.%I', t||'_write', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.app_can_write(account_id)) with check (public.app_can_write(account_id))', t||'_write', t);
  end loop;
end $$;

-- ---------- ONBOARDING: cria conta + dono + padrões ----------
create or replace function public.app_create_account(nome text)
returns uuid language plpgsql security definer set search_path=public as $$
declare acc uuid;
begin
  if auth.uid() is null then raise exception 'precisa estar autenticado'; end if;
  insert into public.app_accounts (name) values (nome) returning id into acc;
  insert into public.app_members (account_id, user_id, role) values (acc, auth.uid(), 'owner');
  insert into public.app_centers (account_id, name, sort_order) values (acc,'Empresa',0),(acc,'Pessoal',1);
  insert into public.app_categories (account_id, type, name, sort_order)
  select acc,'Receita',x.n,x.o from (values ('Vendas',0),('Serviços',1),('Outras receitas',2)) x(n,o);
  insert into public.app_categories (account_id, type, name, sort_order)
  select acc,'Despesa',x.n,x.o from (values
    ('Moradia',0),('Alimentação',1),('Fornecedores',2),('Funcionários',3),('Impostos',4),
    ('Transporte',5),('Energia',6),('Internet / Telefonia',7),('Marketing',8),('Empréstimos',9),('Outras despesas',10)) x(n,o);
  return acc;
end $$;

revoke all on function public.app_create_account(text) from public;
grant execute on function public.app_create_account(text) to authenticated;
;
