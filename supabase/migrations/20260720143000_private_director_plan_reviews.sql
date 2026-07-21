-- Respostas privadas do Plano Diretor. Somente proprietários ativos da Adoce.

create table public.project_decision_reviews (
  decision_id text primary key check (decision_id ~ '^D(0[1-9]|[1-6][0-9]|70)$'),
  rubens_answer text not null default '' check (char_length(rubens_answer) <= 40),
  beth_answer text not null default '' check (char_length(beth_answer) <= 40),
  final_decision text not null default '' check (char_length(final_decision) <= 2000),
  notes text not null default '' check (char_length(notes) <= 4000),
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now()
);

create or replace function private.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_members staff
    where staff.user_id = (select auth.uid())
      and staff.active
      and staff.role = 'owner'
  );
$$;

revoke all on function private.is_owner() from public, anon, authenticated;
grant execute on function private.is_owner() to authenticated;

alter table public.project_decision_reviews enable row level security;

revoke all on table public.project_decision_reviews from public, anon, authenticated;
grant select, insert, update on table public.project_decision_reviews to authenticated;

create policy "owners can read director plan reviews"
on public.project_decision_reviews
for select
to authenticated
using ((select private.is_owner()));

create policy "owners can create director plan reviews"
on public.project_decision_reviews
for insert
to authenticated
with check (
  updated_by = (select auth.uid())
  and (select private.is_owner())
);

create policy "owners can update director plan reviews"
on public.project_decision_reviews
for update
to authenticated
using ((select private.is_owner()))
with check (
  updated_by = (select auth.uid())
  and (select private.is_owner())
);

create index project_decision_reviews_updated_at_idx
  on public.project_decision_reviews(updated_at desc);

comment on table public.project_decision_reviews is
  'Respostas privadas de Rubens e Beth para validação do Plano Diretor da operação de vendas.';
