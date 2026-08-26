revoke all on function public.submit_instant_order_v5(text, text, jsonb, text, text, jsonb) from public;
revoke all on function public.submit_instant_order_v5(text, text, jsonb, text, text, jsonb) from anon;
revoke all on function public.submit_instant_order_v5(text, text, jsonb, text, text, jsonb) from authenticated;

grant execute on function public.submit_instant_order_v5(text, text, jsonb, text, text, jsonb) to anon;
grant execute on function public.submit_instant_order_v5(text, text, jsonb, text, text, jsonb) to authenticated;
