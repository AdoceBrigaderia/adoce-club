-- Estas rotinas sao chamadas pelo Clube depois do login e aplicam a
-- identidade de auth.uid() internamente. Mantemos anonimos bloqueados.

revoke all on function public.customer_referral_overview()
  from public, anon;
revoke all on function public.customer_group_overview()
  from public, anon;
revoke all on function public.create_group_invite(text)
  from public, anon;
revoke all on function public.accept_group_invite(text)
  from public, anon;
revoke all on function public.remove_group_member(uuid)
  from public, anon;
revoke all on function public.accept_referral_invite(text)
  from public, anon;

grant execute on function public.customer_referral_overview()
  to authenticated;
grant execute on function public.customer_group_overview()
  to authenticated;
grant execute on function public.create_group_invite(text)
  to authenticated;
grant execute on function public.accept_group_invite(text)
  to authenticated;
grant execute on function public.remove_group_member(uuid)
  to authenticated;
grant execute on function public.accept_referral_invite(text)
  to authenticated;
