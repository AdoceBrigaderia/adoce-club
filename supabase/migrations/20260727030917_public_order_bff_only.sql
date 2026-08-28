begin;

-- Pedidos anônimos passam exclusivamente pela Function same-origin.
-- Clientes autenticados continuam usando o próprio JWT para fidelidade.
revoke all on function public.get_checkout_payment_methods() from public, anon;
grant execute on function public.get_checkout_payment_methods() to authenticated, service_role;

revoke all on function public.public_quote_instant_order(jsonb,jsonb) from public, anon;
grant execute on function public.public_quote_instant_order(jsonb,jsonb) to authenticated, service_role;

revoke all on function public.submit_instant_order_v5(text,text,jsonb,text,text,jsonb) from public, anon;
grant execute on function public.submit_instant_order_v5(text,text,jsonb,text,text,jsonb) to authenticated, service_role;

commit;
