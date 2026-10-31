-- Revisão do motor de reserva de fatias (relato do proprietário em 29/10/2026):
-- perto do fim do estoque, o caixa "não deixa lançar", não deixa baixar como
-- perda nem como fidelidade, e mostra estoque que não existe mais.
--
-- Causa 1 (corrigida aqui, no banco): carrinho esquecido prendia a última
-- fatia por até 30 minutos antes da rotina de expiração liberar. Reduzido
-- para 10 minutos — o front-end já renova a reserva a cada 5 minutos
-- enquanto a aba está em uso, então quem está ativo nunca perde a reserva.
--
-- Causa 2 (corrigida aqui, no banco): lançar uma fatia como perda falhava
-- com "A perda é maior que as fatias livres deste sabor" sempre que a
-- última unidade estava presa no PRÓPRIO carrinho do atendente que está
-- tentando registrar a perda. Agora a função desconta, só para essa
-- checagem, a reserva que pertence ao próprio atendente (nunca a de outro
-- atendente ou de um pedido já confirmado) e remove essa mesma quantidade
-- do carrinho dele, para o carrinho não ficar reservando uma fatia que
-- acabou de virar perda.
--
-- Causa 3 (corrigida no front-end, não aqui): a tela não recarregava o
-- estoque exibido depois de cada tentativa de reservar, então o número
-- "Livre" ficava desatualizado e os cliques pareciam "não fazer nada".

create or replace function public.staff_set_cash_draft_reservation(target_session_id uuid,target_draft_key text,requested_items jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=(select auth.uid()); today date:=(now() at time zone 'America/Fortaleza')::date; store uuid; r record; a public.flavor_availability%rowtype; previous int;
begin
 select store_id into store from public.cash_sessions where id=target_session_id and status='open' for update;
 if actor is null or not private.is_staff() or store is null or not coalesce(private.can_access_store(store),false) then raise exception 'Abra um caixa autorizado'; end if;
 if target_draft_key is null or char_length(target_draft_key)<8 or jsonb_typeof(requested_items)<>'array' then raise exception 'Pedido inválido'; end if;
 if exists(select 1 from jsonb_array_elements(requested_items) x where (x->>'quantity')::numeric<>trunc((x->>'quantity')::numeric) or (x->>'quantity')::int not between 1 and 60 or x->>'flavor_id' is null) then raise exception 'Quantidade inválida'; end if;
 if exists(select 1 from public.cash_draft_reservations where session_id=target_session_id and draft_key=target_draft_key and created_by<>actor) then raise exception 'Pedido de outro atendente'; end if;
 perform 1 from public.flavor_availability where service_date=today and flavor_id in(select (x->>'flavor_id')::uuid from jsonb_array_elements(requested_items) x union select flavor_id from public.cash_draft_reservations where session_id=target_session_id and draft_key=target_draft_key) order by flavor_id for update;
 for r in select (x->>'flavor_id')::uuid fid,sum((x->>'quantity')::int)::int qty from jsonb_array_elements(requested_items) x group by 1 loop
  select * into a from public.flavor_availability where flavor_id=r.fid and service_date=today;
  select coalesce(sum(quantity),0) into previous from public.cash_draft_reservations where session_id=target_session_id and draft_key=target_draft_key and flavor_id=r.fid and service_date=today;
  if a.id is null or a.status in ('sold_out','unavailable') or coalesce(a.quantity_available-a.quantity_reserved,0)+previous<r.qty then return jsonb_build_object('accepted',false,'message','Estoque insuficiente'); end if;
 end loop;
 perform public.staff_release_cash_draft_reservation(target_session_id,target_draft_key);
 for r in select (x->>'flavor_id')::uuid fid,sum((x->>'quantity')::int)::int qty from jsonb_array_elements(requested_items) x group by 1 loop
  insert into public.cash_draft_reservations(session_id,draft_key,flavor_id,service_date,quantity,created_by,expires_at) values(target_session_id,target_draft_key,r.fid,today,r.qty,actor,now()+interval '10 minutes');
  perform private.recalcular_reserva_de_fatias(r.fid,today);
 end loop;
 return jsonb_build_object('accepted',true);
end; $$;

alter table public.cash_draft_reservations alter column expires_at set default (now() + interval '10 minutes');

create or replace function public.staff_record_slice_loss(target_session_id uuid, target_flavor_id uuid, requested_quantity integer, requested_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  s public.cash_sessions%rowtype; a public.flavor_availability%rowtype;
  today date := (now() at time zone 'America/Fortaleza')::date;
  loss public.slice_losses%rowtype; left_units integer; actor uuid := auth.uid();
  own_reserved integer; free_for_loss integer; to_release integer; d record;
begin
  select * into s from public.cash_sessions where id = target_session_id and status = 'open' for update;
  if actor is null or not private.is_staff() or s.id is null or not private.can_access_store(s.store_id) then
    raise exception 'Abra um caixa autorizado para lançar perdas';
  end if;
  if coalesce(requested_quantity, 0) < 1 then raise exception 'Informe a quantidade perdida'; end if;
  if char_length(btrim(coalesce(requested_reason, ''))) < 3 then raise exception 'Informe o motivo da perda'; end if;
  select * into a from public.flavor_availability where flavor_id = target_flavor_id and service_date = today for update;
  if a.id is null then raise exception 'Este sabor não tem estoque lançado hoje'; end if;

  -- Reserva de carrinhos de OUTROS atendentes, e de pedidos já confirmados,
  -- continua protegida. Só a reserva que pertence ao próprio atendente que
  -- está lançando a perda pode liberar espaço aqui, porque a fatia física
  -- que ele está descartando pode ser a mesma que ele mesmo tinha no carrinho.
  select coalesce(sum(quantity),0) into own_reserved
  from public.cash_draft_reservations
  where flavor_id = target_flavor_id and service_date = today and created_by = actor;
  free_for_loss := coalesce(a.quantity_available,0) - coalesce(a.quantity_reserved,0) + own_reserved;
  if free_for_loss < requested_quantity then
    raise exception 'A perda é maior que as fatias livres deste sabor';
  end if;

  to_release := least(own_reserved, requested_quantity);
  if to_release > 0 then
    for d in
      select * from public.cash_draft_reservations
      where flavor_id = target_flavor_id and service_date = today and created_by = actor
      order by updated_at for update
    loop
      exit when to_release <= 0;
      if d.quantity <= to_release then
        delete from public.cash_draft_reservations where id = d.id;
        to_release := to_release - d.quantity;
      else
        update public.cash_draft_reservations set quantity = d.quantity - to_release, updated_at = now() where id = d.id;
        to_release := 0;
      end if;
    end loop;
    perform private.recalcular_reserva_de_fatias(target_flavor_id, today);
    select * into a from public.flavor_availability where flavor_id = target_flavor_id and service_date = today for update;
  end if;

  left_units := a.quantity_available - requested_quantity;
  update public.flavor_availability
  set quantity_available = left_units,
      status = case
        when left_units - quantity_reserved <= 0 then 'sold_out'::public.availability_status
        when left_units - quantity_reserved <= 3 and status = 'available' then 'last_units'::public.availability_status
        else status end,
      updated_by = auth.uid(), updated_at = now()
  where id = a.id;
  insert into public.slice_losses(session_id, store_id, flavor_id, service_date, quantity, reason)
  values (s.id, s.store_id, target_flavor_id, today, requested_quantity, btrim(requested_reason))
  returning * into loss;
  return to_jsonb(loss);
end; $$;
