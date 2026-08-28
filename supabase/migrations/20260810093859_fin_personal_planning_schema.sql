-- Planejamento financeiro pessoal (Rubens e Beth). Isolado do restante da operação Adoce.

create table if not exists public.fin_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default '',
  created_at timestamptz not null default now()
);

create or replace function public.fin_is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.fin_members m where m.user_id = auth.uid());
$$;

create table if not exists public.fin_settings (
  id boolean primary key default true check (id),
  initial_balance numeric(14,2) not null default 0,
  reserve_goal numeric(6,2) not null default 10,
  week_start smallint not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.fin_categories (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('Receita','Despesa')),
  name text not null,
  sort_order int not null default 0,
  unique (type, name)
);

create table if not exists public.fin_series (
  id uuid primary key default gen_random_uuid(),
  recurrence text not null check (recurrence in ('monthly','weekly')),
  recurrence_weekday smallint,
  start_date date not null,
  end_date date,
  template jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.fin_entries (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('Receita','Despesa')),
  status text not null default 'Previsto' check (status in ('Previsto','Realizado')),
  center text not null default 'Pessoal',
  description text not null,
  value numeric(14,2) not null check (value >= 0),
  category text not null default '',
  date date not null,
  notes text not null default '',
  installment_current int,
  installment_total int,
  series_id uuid references public.fin_series(id) on delete set null,
  recurrence text,
  recurrence_weekday smallint,
  recurrence_unlimited boolean not null default false,
  recurrence_label text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fin_entries_date_idx on public.fin_entries (date);
create index if not exists fin_entries_series_idx on public.fin_entries (series_id);
create index if not exists fin_entries_status_idx on public.fin_entries (status);

create or replace function public.fin_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists fin_entries_touch on public.fin_entries;
create trigger fin_entries_touch before update on public.fin_entries
for each row execute function public.fin_touch_updated_at();

-- RLS: somente membros cadastrados enxergam ou alteram qualquer coisa.
alter table public.fin_members    enable row level security;
alter table public.fin_settings   enable row level security;
alter table public.fin_categories enable row level security;
alter table public.fin_series     enable row level security;
alter table public.fin_entries    enable row level security;

drop policy if exists fin_members_self on public.fin_members;
create policy fin_members_self on public.fin_members
  for select to authenticated using (public.fin_is_member());

do $$
declare t text;
begin
  foreach t in array array['fin_settings','fin_categories','fin_series','fin_entries'] loop
    execute format('drop policy if exists %I on public.%I', t||'_rw', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.fin_is_member()) with check (public.fin_is_member())',
      t||'_rw', t);
  end loop;
end $$;

insert into public.fin_settings (id) values (true) on conflict (id) do nothing;
;
