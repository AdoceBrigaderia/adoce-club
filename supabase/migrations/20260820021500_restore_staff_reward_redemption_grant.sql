begin;

-- A tela de Clientes & Clube e o balcão voltaram a resgatar fatia-presente.
-- A rotina valida auth.uid(), vínculo de equipe e idempotência. O navegador
-- da operação chama o BFF; esta concessão restaura também o caminho interno
-- usado pelos pedidos imediatos.

revoke all on function public.staff_redeem_reward(uuid, boolean, numeric, text)
  from public, anon, authenticated;
grant execute on function public.staff_redeem_reward(uuid, boolean, numeric, text)
  to authenticated;

revoke all on function public.staff_redeem_group_reward(uuid, uuid, boolean, numeric, text)
  from public, anon, authenticated;
grant execute on function public.staff_redeem_group_reward(uuid, uuid, boolean, numeric, text)
  to authenticated;

revoke all on function public.staff_set_instant_order_reward_item(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.staff_set_instant_order_reward_item(uuid, uuid)
  to authenticated;

revoke all on function public.staff_confirm_instant_order_payment(uuid, text)
  from public, anon, authenticated;
grant execute on function public.staff_confirm_instant_order_payment(uuid, text)
  to authenticated;

do $$
begin
  if has_function_privilege('anon', 'public.staff_redeem_group_reward(uuid,uuid,boolean,numeric,text)', 'EXECUTE') then
    raise exception 'staff_redeem_group_reward nao pode ser executada por anon';
  end if;
  if not has_function_privilege('authenticated', 'public.staff_redeem_group_reward(uuid,uuid,boolean,numeric,text)', 'EXECUTE') then
    raise exception 'staff_redeem_group_reward precisa estar disponivel para a equipe autenticada';
  end if;
  if not has_function_privilege('authenticated', 'public.staff_set_instant_order_reward_item(uuid,uuid)', 'EXECUTE') then
    raise exception 'staff_set_instant_order_reward_item precisa estar disponivel para a equipe autenticada';
  end if;
end;
$$;

commit;
