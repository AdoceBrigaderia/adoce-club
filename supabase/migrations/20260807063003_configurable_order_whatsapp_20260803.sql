alter table private.instant_order_settings
  add column if not exists order_whatsapp_number text not null default '5585982156026'
  check (order_whatsapp_number ~ '^55[1-9][0-9]{9,10}$');

create or replace function public.get_public_order_whatsapp_number()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select settings.order_whatsapp_number
  from private.instant_order_settings settings
  where settings.singleton;
$$;
revoke all on function public.get_public_order_whatsapp_number() from public;
grant execute on function public.get_public_order_whatsapp_number() to anon, authenticated;

create or replace function public.staff_update_order_whatsapp_number(next_order_whatsapp_number text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare normalized text := regexp_replace(coalesce(next_order_whatsapp_number, ''), '\D', '', 'g');
begin
  if (select auth.uid()) is null or not private.is_manager() then
    raise exception 'Somente proprietarios podem alterar o WhatsApp dos pedidos';
  end if;
  if length(normalized) in (10, 11) then normalized := '55' || normalized; end if;
  if normalized !~ '^55[1-9][0-9]{9,10}$' then raise exception 'Informe um WhatsApp valido com DDD'; end if;
  update private.instant_order_settings set order_whatsapp_number = normalized, updated_at = now() where singleton;
  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values ((select auth.uid()), 'commerce.order_whatsapp_updated', 'commerce_settings', 'global', jsonb_build_object('number_suffix', right(normalized, 4)));
  return normalized;
end;
$$;
revoke all on function public.staff_update_order_whatsapp_number(text) from public, anon, authenticated;
grant execute on function public.staff_update_order_whatsapp_number(text) to authenticated;

create or replace function public.staff_get_commerce_settings()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if (select auth.uid()) is null or not private.is_staff() then raise exception 'Acesso nao autorizado'; end if;
  select jsonb_build_object(
    'automatic_checkout_enabled', settings.automatic_checkout_enabled,
    'automatic_checkout_minimum', settings.automatic_checkout_minimum,
    'reservation_minutes', settings.reservation_minutes,
    'order_whatsapp_number', settings.order_whatsapp_number,
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
