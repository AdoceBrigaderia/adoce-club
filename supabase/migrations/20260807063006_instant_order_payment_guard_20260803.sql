-- Protege a entrega de pedidos sem pagamento e oferece a combinação mais pedida.

insert into public.order_sauces (name, active, sort_order)
values ('Calda de Ninho e chocolate', true, 30)
on conflict (lower(btrim(name))) do nothing;

create or replace function private.enforce_instant_order_payment_before_ready()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('ready', 'completed')
     and new.payment_status is distinct from 'approved' then
    raise exception 'Confirme o pagamento antes de marcar o pedido como pronto ou entregue';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_instant_order_payment_before_ready()
  from public, anon, authenticated;

drop trigger if exists instant_orders_require_payment_before_ready on public.instant_orders;
create trigger instant_orders_require_payment_before_ready
before insert or update of status, payment_status on public.instant_orders
for each row execute function private.enforce_instant_order_payment_before_ready();

comment on function private.enforce_instant_order_payment_before_ready() is
  'Impede que pedidos não pagos sejam marcados como prontos ou entregues.';
