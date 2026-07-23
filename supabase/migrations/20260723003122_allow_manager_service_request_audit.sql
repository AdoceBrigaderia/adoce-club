-- O cancelamento de uma solicitacao e sua auditoria precisam ser atomicos.
-- A RPC roda com as permissoes do usuario autenticado; por isso, o gerente
-- precisa de uma politica INSERT explicita na tabela protegida por RLS.
create policy audit_manager_insert
on public.audit_events
for insert
to authenticated
with check (
  private.is_manager()
  and actor_user_id = (select auth.uid())
);

-- A atualizacao de pedidos e uma acao interna. Remove uma permissao antiga
-- herdada pelo papel anonimo e mantem a execucao apenas para a equipe logada.
revoke execute on function public.manager_update_service_request(uuid,text,numeric,numeric,text) from anon;
grant execute on function public.manager_update_service_request(uuid,text,numeric,numeric,text) to authenticated;
