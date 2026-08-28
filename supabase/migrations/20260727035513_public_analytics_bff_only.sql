begin;

revoke execute on function public.record_site_analytics_event(uuid,text,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.record_site_analytics_event(uuid,text,text,jsonb)
  to service_role;

commit;
