-- Garante que todo pedido, independentemente do canal de entrada, já nasça
-- com os valores financeiros obrigatórios preenchidos.

create or replace function private.apply_instant_order_global_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  configured_minutes integer;
begin
  if tg_op = 'INSERT' then
    new.gross_amount := coalesce(new.gross_amount, new.total, 0);
    new.payment_fee_amount := coalesce(new.payment_fee_amount, 0);
    new.net_amount := coalesce(
      new.net_amount,
      greatest(0, new.gross_amount - new.payment_fee_amount)
    );
  end if;

  if new.status in ('reserved', 'awaiting_payment')
     and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    configured_minutes := private.current_instant_order_reservation_minutes();
    new.reserved_until := now() + make_interval(mins => configured_minutes);
    if new.status = 'awaiting_payment' then
      new.payment_expires_at := new.reserved_until;
    end if;
  end if;

  if new.payment_status = 'approved'
     and (tg_op = 'INSERT' or old.payment_status is distinct from 'approved') then
    new.payment_recorded_at := coalesce(new.payment_recorded_at, now());
    new.gross_amount := new.total;
    new.payment_fee_amount := least(
      new.total,
      round(
        (new.total * coalesce(new.payment_fee_percent, 0) / 100)
        + coalesce(new.payment_fee_fixed, 0),
        2
      )
    );
    new.net_amount := greatest(0, new.total - new.payment_fee_amount);
  end if;

  return new;
end;
$$;

revoke all on function private.apply_instant_order_global_rules()
  from public, anon, authenticated;

drop trigger if exists instant_orders_global_rules on public.instant_orders;
create trigger instant_orders_global_rules
before insert or update of status, payment_status on public.instant_orders
for each row execute function private.apply_instant_order_global_rules();

