-- "Reserva confirmada" passa a segurar o estoque SEM prazo.
--
-- Contexto: hoje, quando um pedido instantaneo sai de 'awaiting_confirmation',
-- o gatilho private.apply_instant_order_global_rules arma
-- reserved_until = now() + reservation_minutes (15 min por padrao) tanto para
-- 'reserved' quanto para 'awaiting_payment', e o cron
-- expire_instant_order_reservations devolve o estoque e marca o pedido como
-- 'expired' quando o prazo estoura.
--
-- A operacao precisa de um passo intermediario: confirmar a reserva (a fatia
-- sai da disponibilidade publica e fica separada para o cliente) ANTES de
-- enviar a cobranca, porque o cliente ainda pode incluir itens. Enquanto a
-- cobranca nao foi enviada, essa reserva nao pode ter cronometro -- senao ela
-- expira no meio do atendimento e a fatia volta a aparecer para outro cliente.
--
-- Decisao (Rubens, 2026-09-05): "sem prazo ate a cobranca".
--   * status 'reserved'         -> reserved_until = NULL (sem prazo)
--   * status 'awaiting_payment' -> reserved_until = now() + reservation_minutes
--                                  e payment_expires_at = reserved_until
--
-- Rede de seguranca: o cron ainda limpa reservas 'reserved' que sobraram de um
-- dia de atendimento anterior (pedido e sempre para o mesmo dia), para que uma
-- reserva nao paga nunca fique presa para sempre.

begin;

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

  -- Cronometro so vale a partir de 'awaiting_payment' (cobranca enviada).
  -- 'reserved' (reserva confirmada) segura o estoque sem prazo: a fatia so
  -- volta a disponibilidade quando a loja envia a cobranca ou cancela.
  if new.status = 'awaiting_payment'
     and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    configured_minutes := private.current_instant_order_reservation_minutes();
    new.reserved_until := now() + make_interval(mins => configured_minutes);
    new.payment_expires_at := new.reserved_until;
  elsif new.status = 'reserved'
     and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    new.reserved_until := null;
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

-- O cron continua expirando cobrancas nao pagas no prazo. Alem disso, limpa
-- reservas confirmadas que sobraram de um dia anterior (sem prazo, mas o
-- pedido e sempre para o mesmo dia -- se virou o dia, a reserva perdeu o
-- sentido e o estoque precisa voltar).
create or replace function public.expire_instant_order_reservations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target record;
  expired_count integer := 0;
begin
  for target in
    select id from public.instant_orders
    where (
        status = 'awaiting_payment'
        and reserved_until is not null
        and reserved_until < now()
      )
      or (
        status = 'reserved'
        and (created_at at time zone 'America/Fortaleza')::date
            < (now() at time zone 'America/Fortaleza')::date
      )
    for update skip locked
  loop
    perform private.release_instant_order_stock(target.id);
    update public.instant_orders set status = 'expired', payment_status = 'expired',
      reserved_until = null, cancellation_reason = 'Prazo de reserva encerrado', updated_at = now()
    where id = target.id;
    expired_count := expired_count + 1;
  end loop;
  return expired_count;
end;
$$;
revoke all on function public.expire_instant_order_reservations() from public, anon, authenticated;
grant execute on function public.expire_instant_order_reservations() to service_role;

-- Backfill: reservas confirmadas hoje ainda tem um reserved_until armado pela
-- regra antiga. Zera para que parem de contar (nao mexe em status/payment_status,
-- entao o gatilho instant_orders_global_rules nao dispara).
update public.instant_orders
set reserved_until = null, updated_at = now()
where status = 'reserved' and reserved_until is not null;

commit;
