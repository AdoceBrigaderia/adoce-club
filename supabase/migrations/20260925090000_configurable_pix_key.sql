-- Chave Pix configurável pela operação (pedido de 25/09/2026).
-- Corrige a chave: o certo é pagamento@adocebrigaderia.com.br (sem "s").
-- As mensagens automáticas do WhatsApp, o Caixa e o painel do pedido leem daqui.

alter table private.instant_order_settings
  add column if not exists pix_key text not null default 'pagamento@adocebrigaderia.com.br'
  check (char_length(btrim(pix_key)) between 3 and 140);

update private.instant_order_settings
set pix_key = 'pagamento@adocebrigaderia.com.br'
where singleton and pix_key = 'pagamentos@adocebrigaderia.com.br';

create or replace function public.staff_get_commerce_settings()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if (select auth.uid()) is null or not private.is_staff() then raise exception 'Acesso nao autorizado'; end if;
  select jsonb_build_object(
    'automatic_checkout_enabled', settings.automatic_checkout_enabled,
    'automatic_checkout_minimum', settings.automatic_checkout_minimum,
    'reservation_minutes', settings.reservation_minutes,
    'order_whatsapp_number', settings.order_whatsapp_number,
    'pix_key', settings.pix_key,
    'payment_methods', coalesce((select jsonb_agg(jsonb_build_object(
      'code', method.code, 'label', method.label, 'fee_percent', method.fee_percent,
      'fee_fixed', method.fee_fixed, 'active', method.active,
      'customer_selectable', method.customer_selectable, 'sort_order', method.sort_order
    ) order by method.sort_order, method.label) from public.payment_methods method), '[]'::jsonb)
  ) into result
  from private.instant_order_settings settings where settings.singleton;
  return result;
end;
$$;

create or replace function public.manager_set_pix_key(requested_pix_key text)
returns text language plpgsql security definer set search_path = '' as $$
declare clean text := btrim(coalesce(requested_pix_key, ''));
begin
  if auth.uid() is null or not private.is_manager() then raise exception 'Acesso não autorizado'; end if;
  if char_length(clean) < 3 or char_length(clean) > 140 then raise exception 'Informe uma chave Pix válida'; end if;
  update private.instant_order_settings set pix_key = clean where singleton;
  return clean;
end; $$;
revoke all on function public.manager_set_pix_key(text) from public, anon;
grant execute on function public.manager_set_pix_key(text) to authenticated;

-- Leitura pelas funções do servidor (mensagens automáticas do WhatsApp).
create or replace function public.server_get_pix_key()
returns text language sql stable security definer set search_path = '' as $$
  select pix_key from private.instant_order_settings where singleton;
$$;
revoke all on function public.server_get_pix_key() from public, anon, authenticated;
grant execute on function public.server_get_pix_key() to service_role;
