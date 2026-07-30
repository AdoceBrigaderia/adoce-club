begin;

-- As capacidades de participante e organizador passam a existir somente em
-- cookie HttpOnly processado pela Function same-origin.
revoke all on function public.create_pede_junto_group(text,text,text,text,text)
  from public, anon, authenticated;
revoke all on function public.join_pede_junto_group(text,text,text,text)
  from public, anon, authenticated;
revoke all on function public.pede_junto_room(text,text,text)
  from public, anon, authenticated;
revoke all on function public.set_pede_junto_selection(text,text,uuid,integer)
  from public, anon, authenticated;
revoke all on function public.submit_pede_junto_group(text,text)
  from public, anon, authenticated;

grant execute on function public.create_pede_junto_group(text,text,text,text,text)
  to service_role;
grant execute on function public.join_pede_junto_group(text,text,text,text)
  to service_role;
grant execute on function public.pede_junto_room(text,text,text)
  to service_role;
grant execute on function public.set_pede_junto_selection(text,text,uuid,integer)
  to service_role;
grant execute on function public.submit_pede_junto_group(text,text)
  to service_role;

commit;
