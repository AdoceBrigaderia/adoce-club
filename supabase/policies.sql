alter table public.profiles enable row level security;alter table public.families enable row level security;alter table public.family_members enable row level security;alter table public.cash_sessions enable row level security;alter table public.sales enable row level security;alter table public.sale_tokens enable row level security;alter table public.loyalty_cards enable row level security;alter table public.loyalty_events enable row level security;alter table public.rewards enable row level security;alter table public.referrals enable row level security;alter table public.app_settings enable row level security;
create or replace function public.current_role() returns user_role language sql stable security definer set search_path=public as $$select role from profiles where id=auth.uid()$$;
create policy profiles_self on public.profiles for select using(id=auth.uid() or public.current_role()='admin');
create policy profiles_update_self on public.profiles for update using(id=auth.uid()) with check(id=auth.uid());
create policy sales_seller_or_admin on public.sales for select using(seller_id=auth.uid() or public.current_role()='admin');
create policy sales_insert_staff on public.sales for insert with check(seller_id=auth.uid() and public.current_role() in ('seller','admin'));
create policy cash_staff_read on public.cash_sessions for select using(public.current_role() in ('seller','admin'));
create policy cash_admin_write on public.cash_sessions for all using(public.current_role()='admin') with check(public.current_role()='admin');
create policy settings_read on public.app_settings for select using(auth.uid() is not null);
create policy settings_admin on public.app_settings for all using(public.current_role()='admin') with check(public.current_role()='admin');
create policy family_member_read on public.families for select using(owner_id=auth.uid() or exists(select 1 from family_members m where m.family_id=id and m.profile_id=auth.uid()) or public.current_role()='admin');
create policy family_members_read on public.family_members for select using(profile_id=auth.uid() or exists(select 1 from families f where f.id=family_id and f.owner_id=auth.uid()) or public.current_role()='admin');
create policy cards_owner_read on public.loyalty_cards for select using(profile_id=auth.uid() or exists(select 1 from family_members m where m.family_id=loyalty_cards.family_id and m.profile_id=auth.uid()) or public.current_role()='admin');
create policy events_owner_read on public.loyalty_events for select using(profile_id=auth.uid() or exists(select 1 from loyalty_cards c left join family_members m on m.family_id=c.family_id where c.id=card_id and (c.profile_id=auth.uid() or m.profile_id=auth.uid())) or public.current_role()='admin');
create policy rewards_owner_read on public.rewards for select using(exists(select 1 from loyalty_cards c left join family_members m on m.family_id=c.family_id where c.id=card_id and (c.profile_id=auth.uid() or m.profile_id=auth.uid())) or public.current_role()='admin');
create policy referrals_parties on public.referrals for select using(referrer_id=auth.uid() or referred_id=auth.uid() or public.current_role()='admin');
-- Token claim, stamp issuance, reward issuance and referral bonuses must be implemented by security-definer RPCs in one transaction; clients receive no direct write policy.
