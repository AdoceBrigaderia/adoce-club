-- Pedidos online so dentro do horario (pedido do proprietario em 31/10/2026).
-- O horario do canal online_orders (business_hours, hoje 09h-22h) existia mas
-- deixou de ser conferido em 20260819170000 junto com a janela do Cantinho; um
-- cliente conseguiu pedir as 23h35 com a loja fechada.
-- Agora o banco recusa pedido do site fora do horario do dia (Fortaleza).
-- business_hour_exceptions do canal online_orders permite fechar ou mudar o
-- horario de um dia especifico (closed = true fecha o dia todo).

create or replace function private.online_orders_open_now()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  with now_local as (
    select (now() at time zone 'America/Fortaleza') ts
  ), today_exception as (
    select e.* from public.business_hour_exceptions e, now_local
    where e.channel_slug = 'online_orders' and e.service_date = now_local.ts::date
    order by e.updated_at desc limit 1
  )
  select case
    when exists (select 1 from today_exception) then
      (select not coalesce(e.closed, false)
              and (e.opens_at is null or n.ts::time >= e.opens_at)
              and (e.closes_at is null or n.ts::time < e.closes_at)
       from today_exception e, now_local n)
    else exists (
      select 1 from public.business_hours h, now_local n
      where h.channel_slug = 'online_orders' and h.active
        and h.weekday = extract(dow from n.ts)::int
        and n.ts::time >= h.opens_at and n.ts::time < h.closes_at
    )
  end;
$$;
revoke all on function private.online_orders_open_now() from public;

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
     and not coalesce(private.is_staff(), false)
     and not private.online_orders_open_now() then
    raise exception 'Os pedidos online estão encerrados agora. Voltamos a receber pedidos no próximo horário de funcionamento.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists instant_orders_online_hours on public.instant_orders;
create trigger instant_orders_online_hours
  before insert on public.instant_orders
  for each row execute function private.reject_online_order_outside_hours();
