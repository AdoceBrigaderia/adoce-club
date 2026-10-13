-- URGENTE: "Nao ha estoque suficiente para confirmar este pedido" disparando
-- para pedidos com estoque real de sobra.
--
-- Causa raiz: private.recalcular_reserva_de_fatias() (acionada pelo gatilho
-- sincroniza_reserva_itens em instant_order_items) recalculava
-- flavor_availability.quantity_reserved somando TODOS os itens com status
-- diferente de 'cancelled' -- inclusive itens 'selected', de pedidos que
-- ainda nem foram revisados pela loja (status do pedido ainda
-- 'awaiting_confirmation'). Isso conta pedido pendente como se already fosse
-- estoque reservado, e conflita com o fluxo ja existente que so reserva de
-- fato em private.reserve_instant_order_stock / staff_update_instant_order
-- (que movem o item para 'reserved' e so ai debitam o estoque). Resultado:
-- o proprio pedido novo (ainda 'selected') ja aparecia como reserva fantasma
-- e bloqueava a confirmacao dele mesmo, ou de qualquer pedido concorrente do
-- mesmo sabor.
--
-- Esta funcao nao estava rastreada em nenhuma migracao anterior deste
-- repositorio (aplicada direto no banco, fora do fluxo normal) -- corrigida e
-- registrada aqui.
--
-- Correcao: contar apenas itens com status = 'reserved' (o unico status que
-- de fato representa estoque retido e ainda nao vendido; 'paid' ja debita
-- quantity_available diretamente em staff_update_instant_order e nao deve
-- ser somado de novo aqui). Em seguida, recalcula os sabores de hoje para
-- destravar imediatamente os pedidos presos na fila.

begin;

create or replace function private.recalcular_reserva_de_fatias(
  alvo_flavor uuid, alvo_data date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.flavor_availability a
  set quantity_reserved = coalesce((
        select sum(i.quantity)::int
        from public.instant_order_items i
        join public.instant_orders o on o.id = i.order_id
        where i.flavor_id = alvo_flavor
          and (o.created_at at time zone 'America/Fortaleza')::date = alvo_data
          and o.status not in ('cancelled','expired')
          and i.status = 'reserved'
      ), 0),
      updated_at = now()
  where a.flavor_id = alvo_flavor and a.service_date = alvo_data;
end;
$$;

-- Destrava imediatamente: recalcula todo sabor/dia de hoje com a formula
-- corrigida (idempotente -- so recalcula, nao altera nada fora do escopo).
do $$
declare
  linha record;
begin
  for linha in
    select distinct flavor_id, service_date
    from public.flavor_availability
    where service_date = (now() at time zone 'America/Fortaleza')::date
  loop
    perform private.recalcular_reserva_de_fatias(linha.flavor_id, linha.service_date);
  end loop;
end;
$$;

commit;
