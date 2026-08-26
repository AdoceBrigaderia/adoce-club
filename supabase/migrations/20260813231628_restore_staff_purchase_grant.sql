begin;

-- A tela vigente de Clientes & Clube voltou a registrar compras diretamente
-- por esta RPC. A rotina valida auth.uid(), vínculo ativo de equipe,
-- participação do cliente na conta e chave de idempotência antes de escrever.
revoke all on function public.staff_record_purchase(uuid, uuid, smallint, text, text)
  from public, anon, authenticated;
grant execute on function public.staff_record_purchase(uuid, uuid, smallint, text, text)
  to authenticated;

do $$
begin
  if has_function_privilege('anon', 'public.staff_record_purchase(uuid,uuid,smallint,text,text)', 'EXECUTE') then
    raise exception 'staff_record_purchase nao pode ser executada por anon';
  end if;
  if not has_function_privilege('authenticated', 'public.staff_record_purchase(uuid,uuid,smallint,text,text)', 'EXECUTE') then
    raise exception 'staff_record_purchase precisa estar disponivel para a equipe autenticada';
  end if;
end;
$$;

commit;
