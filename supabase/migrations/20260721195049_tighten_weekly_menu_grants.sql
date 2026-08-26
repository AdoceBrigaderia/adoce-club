revoke all privileges on table public.weekly_service_menu from anon, authenticated;
grant select on table public.weekly_service_menu to anon;
grant select, insert, update, delete on table public.weekly_service_menu to authenticated;
