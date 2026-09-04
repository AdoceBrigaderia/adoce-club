-- O tablet só imprime pedido novo que o próprio canal em tempo real dele viu
-- passar, e só quem está com o tablet na mão consegue mandar reimprimir os
-- pendentes (tela "Impressora automática", só aparece dentro do app nativo).
-- Isto dá ao portal de operação — de qualquer navegador, sem Bluetooth — um
-- jeito de mandar esse mesmo comando a distância: grava um sinal aqui, o
-- tablet já está ouvindo esta tabela pelo mesmo canal que ouve pedido novo
-- (AdoceOrderService.java) e reage buscando e imprimindo os pendentes.

begin;

create table public.operation_print_commands (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid references public.staff_members(user_id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.operation_print_commands enable row level security;

create policy operation_print_commands_staff_select
  on public.operation_print_commands
  for select to authenticated
  using (private.is_staff());

revoke all on public.operation_print_commands from public, anon, authenticated;
grant select on public.operation_print_commands to authenticated;

alter publication supabase_realtime add table public.operation_print_commands;

-- Só um jeito de gravar: pela RPC, não por insert direto na tabela — mesmo
-- padrão de server_upsert_flavor_availability_batch e afins neste projeto.
-- Aproveita a chamada pra limpar sinais de mais de 1h, sem precisar de cron.
create or replace function public.server_request_pending_orders_print()
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  new_id uuid;
begin
  if (select auth.uid()) is null or not private.is_staff() then
    raise exception 'Acesso não autorizado';
  end if;

  delete from public.operation_print_commands where created_at < now() - interval '1 hour';

  insert into public.operation_print_commands(requested_by)
  values ((select auth.uid()))
  returning id into new_id;

  return new_id;
end;
$function$;

revoke all on function public.server_request_pending_orders_print()
  from public, anon, authenticated;
grant execute on function public.server_request_pending_orders_print()
  to authenticated;

commit;
