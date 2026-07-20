create table if not exists public.site_feedback (
  id uuid primary key default gen_random_uuid(),
  protocol text not null unique,
  profile_id uuid references public.profiles(id) on delete set null,
  category text not null check (category in ('problem', 'complaint', 'suggestion', 'compliment')),
  customer_name text not null check (char_length(customer_name) between 2 and 120),
  customer_email text,
  customer_phone text,
  page_url text not null default '' check (char_length(page_url) <= 500),
  message text not null check (char_length(message) between 10 and 3000),
  status text not null default 'new' check (status in ('new', 'reviewing', 'resolved', 'closed')),
  internal_notes text not null default '' check (char_length(internal_notes) <= 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists site_feedback_status_created_idx
  on public.site_feedback(status, created_at desc);

alter table public.site_feedback enable row level security;
revoke all on table public.site_feedback from public, anon, authenticated;
grant select, update on table public.site_feedback to authenticated;

drop policy if exists site_feedback_staff_read on public.site_feedback;
create policy site_feedback_staff_read on public.site_feedback
  for select to authenticated using (private.is_staff());

drop policy if exists site_feedback_staff_update on public.site_feedback;
create policy site_feedback_staff_update on public.site_feedback
  for update to authenticated using (private.is_staff()) with check (private.is_staff());
