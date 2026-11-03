begin;

-- Falha encontrada em 02/11/2026: a Operação consegue "pausar" os pedidos
-- online em store_channels (status = 'paused'), e o site mostra o aviso
-- correto de "pedidos encerrados por hoje" -- mas o banco não recusava o
-- pedido de verdade. O trigger instant_orders_online_hours só conferia o
-- horário de funcionamento (business_hours/business_hour_exceptions), nunca
-- o status manual do canal. Uma aba já aberta antes da pausa, ou qualquer
-- cliente que contornasse o aviso do site, conseguia enviar o pedido mesmo
-- assim. Agora o trigger recusa também quando o canal está pausado.
create or replace function private.reject_online_order_outside_hours()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  -- So o cliente no site: vendas e pedidos lancados pela equipe (caixa,
  -- atendimento) continuam liberados a qualquer hora.
  if coalesce(new.sales_channel, 'site') = 'site'
     and not coalesce(private.is_staff(), false) then
    if exists (
      select 1 from public.store_channels
      where slug = 'online_orders' and status = 'paused'
    ) then
      raise exception 'Os pedidos online estão pausados no momento. Voltamos a receber pedidos em breve.'
        using errcode = 'P0001';
    end if;
    if not private.online_orders_open_now() then
      raise exception 'Os pedidos online estão encerrados agora. Voltamos a receber pedidos no próximo horário de funcionamento.'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

commit;
