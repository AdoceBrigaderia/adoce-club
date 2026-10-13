-- "Reimprimir selecionados" no portal de operacao (navegador comum, sem
-- Bluetooth) nao acontecia nada: thermal-printer.ts so sabe imprimir de
-- fato dentro do app nativo do tablet (Capacitor) ou com Web Bluetooth
-- pareado no mesmo navegador. Fora disso ela so grava uma flag na
-- localStorage do PROPRIO navegador do atendente -- que ninguem le -- e
-- devolve "queued_for_android" sem mandar nada a lugar nenhum.
--
-- Reaproveita o canal ja usado por server_request_pending_orders_print
-- (operation_print_commands, ouvido pelo tablet em tempo real), agora
-- carregando os IDs especificos a reimprimir. Nulo continua significando
-- "imprima os pendentes"; com IDs, o tablet reimprime exatamente essas
-- comandas (mesmo que ja estejam marcadas como impressas).

begin;

alter table public.operation_print_commands
  add column order_ids uuid[];

create or replace function public.server_request_order_reprint(
  target_order_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  new_id uuid;
  valid_count integer;
begin
  if (select auth.uid()) is null or not private.is_staff() then
    raise exception 'Acesso não autorizado';
  end if;
  if target_order_ids is null or array_length(target_order_ids, 1) is null
     or array_length(target_order_ids, 1) < 1 then
    raise exception 'Selecione ao menos um pedido para reimprimir';
  end if;
  if array_length(target_order_ids, 1) > 50 then
    raise exception 'Selecione no máximo 50 pedidos por vez';
  end if;

  select count(*) into valid_count
  from public.instant_orders
  where id = any(target_order_ids);
  if valid_count = 0 then
    raise exception 'Nenhum dos pedidos selecionados foi encontrado';
  end if;

  delete from public.operation_print_commands where created_at < now() - interval '1 hour';

  insert into public.operation_print_commands(requested_by, order_ids)
  values ((select auth.uid()), target_order_ids)
  returning id into new_id;

  return new_id;
end;
$function$;

revoke all on function public.server_request_order_reprint(uuid[])
  from public, anon, authenticated;
grant execute on function public.server_request_order_reprint(uuid[])
  to authenticated;

commit;
