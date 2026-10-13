-- Reserva imediata do estoque para rascunhos do caixa.
create table if not exists public.cash_draft_reservations (
  id uuid primary key default gen_random_uuid(), session_id uuid not null references public.cash_sessions(id) on delete cascade,
  draft_key text not null, flavor_id uuid not null references public.flavors(id), service_date date not null,
  quantity integer not null check (quantity > 0), expires_at timestamptz not null default (now() + interval '30 minutes'), created_by uuid not null references auth.users(id), updated_at timestamptz not null default now(), unique(session_id,draft_key,flavor_id)
);
alter table public.cash_draft_reservations enable row level security;
revoke all on public.cash_draft_reservations from public, anon, authenticated;
grant select on public.cash_draft_reservations to authenticated;
drop policy if exists cash_draft_reservations_staff_read on public.cash_draft_reservations;
create policy cash_draft_reservations_staff_read on public.cash_draft_reservations for select to authenticated using (private.can_access_store((select store_id from public.cash_sessions where id=session_id)));

create or replace function public.staff_set_cash_draft_reservation(target_session_id uuid, target_draft_key text, requested_items jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid := (select auth.uid()); today date := (now() at time zone 'America/Fortaleza')::date; session_row public.cash_sessions%rowtype; entry jsonb; fid uuid; wanted integer; old_qty integer; available integer; conflicts jsonb := '[]'::jsonb;
begin
 if actor is null or not private.is_staff() then raise exception 'Acesso nao autorizado'; end if;
 select * into session_row from public.cash_sessions where id=target_session_id and status='open' for update;
 if session_row.id is null then raise exception 'O caixa nao esta aberto'; end if;
 if char_length(btrim(target_draft_key)) < 8 then raise exception 'Rascunho invalido'; end if;
 perform 1 from public.flavor_availability where service_date=today and flavor_id in (select (x->>'flavor_id')::uuid from jsonb_array_elements(coalesce(requested_items,'[]'::jsonb)) x) for update;
 for entry in select * from jsonb_array_elements(coalesce(requested_items,'[]'::jsonb)) loop
   fid := (entry->>'flavor_id')::uuid; wanted := greatest(0,coalesce((entry->>'quantity')::integer,0));
   select coalesce(quantity,0) into old_qty from public.cash_draft_reservations where session_id=target_session_id and draft_key=target_draft_key and flavor_id=fid;
   select coalesce(greatest(0,quantity_available-quantity_reserved),0) + coalesce(old_qty,0) into available from public.flavor_availability where flavor_id=fid and service_date=today;
   if wanted > available then conflicts := conflicts || jsonb_build_array(jsonb_build_object('flavor_id',fid,'requested',wanted,'available',available)); end if;
 end loop;
 if jsonb_array_length(conflicts)>0 then return jsonb_build_object('accepted',false,'conflicts',conflicts); end if;
 for entry in select * from jsonb_array_elements(coalesce(requested_items,'[]'::jsonb)) loop
   fid := (entry->>'flavor_id')::uuid; wanted := greatest(0,coalesce((entry->>'quantity')::integer,0));
   select coalesce(quantity,0) into old_qty from public.cash_draft_reservations where session_id=target_session_id and draft_key=target_draft_key and flavor_id=fid;
   update public.flavor_availability set quantity_reserved=greatest(0,quantity_reserved+(wanted-coalesce(old_qty,0))),updated_at=now() where flavor_id=fid and service_date=today;
   if wanted=0 then delete from public.cash_draft_reservations where session_id=target_session_id and draft_key=target_draft_key and flavor_id=fid; else insert into public.cash_draft_reservations(session_id,draft_key,flavor_id,service_date,quantity,expires_at,created_by,updated_at) values(target_session_id,target_draft_key,fid,today,wanted,now()+interval '30 minutes',actor,now()) on conflict(session_id,draft_key,flavor_id) do update set quantity=excluded.quantity,expires_at=excluded.expires_at,updated_at=now(); end if;
 end loop;
 return jsonb_build_object('accepted',true,'draft_key',target_draft_key);
end; $$;
revoke all on function public.staff_set_cash_draft_reservation(uuid,text,jsonb) from public,anon;
grant execute on function public.staff_set_cash_draft_reservation(uuid,text,jsonb) to authenticated;

create or replace function public.staff_release_cash_draft_reservation(target_session_id uuid, target_draft_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid := (select auth.uid()); row_item record; released integer := 0;
begin
 if actor is null or not private.is_staff() then raise exception 'Acesso nao autorizado'; end if;
 if char_length(btrim(target_draft_key)) < 8 then raise exception 'Rascunho invalido'; end if;
 for row_item in
   select d.flavor_id, d.quantity, d.service_date
   from public.cash_draft_reservations d
   where d.session_id=target_session_id and d.draft_key=target_draft_key
   for update
 loop
   update public.flavor_availability
     set quantity_reserved=greatest(0, quantity_reserved-row_item.quantity), updated_at=now()
     where flavor_id=row_item.flavor_id and service_date=row_item.service_date;
   released := released + row_item.quantity;
 end loop;
 delete from public.cash_draft_reservations where session_id=target_session_id and draft_key=target_draft_key;
 return jsonb_build_object('released', released, 'draft_key', target_draft_key);
end; $$;
revoke all on function public.staff_release_cash_draft_reservation(uuid,text) from public,anon;
grant execute on function public.staff_release_cash_draft_reservation(uuid,text) to authenticated;


