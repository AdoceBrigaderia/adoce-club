create table public.cash_closing_reports (
 id uuid primary key default gen_random_uuid(), session_id uuid not null unique references public.cash_sessions(id),
 store_id uuid not null references public.stores(id), report jsonb not null, created_at timestamptz not null default now(), printed_at timestamptz
);
alter table public.cash_closing_reports enable row level security;
revoke all on public.cash_closing_reports from public,anon,authenticated;
grant select on public.cash_closing_reports to authenticated;
create policy cash_closing_reports_staff_read on public.cash_closing_reports for select to authenticated using(private.is_staff() and private.can_access_store(store_id));

create or replace function public.staff_close_cash_with_report(target_session_id uuid,next_counted_cash numeric)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb; store uuid;
begin
 select store_id into store from public.cash_sessions where id=target_session_id for update;
 if auth.uid() is null or not private.is_staff() or store is null or not private.can_access_store(store) then raise exception 'Acesso não autorizado'; end if;
 select report into r from public.cash_closing_reports where session_id=target_session_id;
 if r is not null then return r; end if;
 if exists(select 1 from public.cash_draft_reservations where session_id=target_session_id) then raise exception 'Existem pedidos iniciados. Conclua ou cancele antes de fechar'; end if;
 perform public.staff_close_cash_session(target_session_id,next_counted_cash,'Fechamento pela tela Caixa');
 r:=public.staff_cash_closing_report(target_session_id);
 insert into public.cash_closing_reports(session_id,store_id,report) values(target_session_id,store,r);
 return r;
end; $$;
revoke all on function public.staff_close_cash_with_report(uuid,numeric) from public,anon;
grant execute on function public.staff_close_cash_with_report(uuid,numeric) to authenticated;

create or replace function public.staff_ack_cash_closing_print(target_report_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.is_staff() then raise exception 'Acesso não autorizado'; end if;
 update public.cash_closing_reports set printed_at=coalesce(printed_at,now()) where id=target_report_id and private.can_access_store(store_id);
 if not found then raise exception 'Relatório não encontrado'; end if;
end; $$;
revoke all on function public.staff_ack_cash_closing_print(uuid) from public,anon;
grant execute on function public.staff_ack_cash_closing_print(uuid) to authenticated;
