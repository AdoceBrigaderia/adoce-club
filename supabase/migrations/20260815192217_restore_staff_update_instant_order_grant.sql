begin;

-- A fila vigente de pedidos usa esta RPC para confirmar, avançar e cancelar
-- pedidos. A própria função exige auth.uid() e vínculo ativo de equipe antes
-- de alterar o pedido, liberar estoque ou registrar a auditoria.
revoke all on function public.staff_update_instant_order(uuid, text, text, timestamptz, text, text)
  from public, anon, authenticated;
grant execute on function public.staff_update_instant_order(uuid, text, text, timestamptz, text, text)
  to authenticated;

do $$
begin
  if has_function_privilege(
    'anon',
    'public.staff_update_instant_order(uuid,text,text,timestamptz,text,text)',
    'EXECUTE'
  ) then
    raise exception 'staff_update_instant_order nao pode ser executada por anon';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.staff_update_instant_order(uuid,text,text,timestamptz,text,text)',
    'EXECUTE'
  ) then
    raise exception 'staff_update_instant_order precisa estar disponivel para a equipe autenticada';
  end if;
end;
$$;

commit;
