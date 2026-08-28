-- Hotfix isolado: o checkout publico precisa consultar apenas os meios ativos
-- e selecionaveis pelo cliente. A funcao ja limita a resposta a codigo e
-- rotulo; esta migracao restaura somente a permissao de execucao perdida no
-- endurecimento de 27/07/2026.
revoke all on function public.get_checkout_payment_methods() from public;
grant execute on function public.get_checkout_payment_methods() to anon, authenticated;
