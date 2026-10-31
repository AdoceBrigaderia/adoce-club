-- Resumo de carrinhos ativos/abandonados pro painel "Pedidos online" do Caixa
-- (pedido do proprietário em 29/10/2026): em vez de mostrar status de pedido
-- já finalizado ("aguardando pagamento", "prontos"), mostrar quantos carrinhos
-- estão sendo montados agora e quais estão parados há mais de 5 minutos sem
-- nenhuma alteração — com um jeito de liberar o estoque desses na hora.

create or replace function public.staff_list_cash_carts()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid());
begin
  if actor is null or not private.is_staff() then raise exception 'Acesso não autorizado'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(cart) order by cart.updated_at desc)
    from (
      select
        d.session_id,
        d.draft_key,
        sum(d.quantity)::int as quantity,
        max(d.updated_at) as updated_at,
        (max(d.updated_at) < now() - interval '5 minutes') as abandoned
      from public.cash_draft_reservations d
      join public.cash_sessions s on s.id = d.session_id and s.status = 'open'
      where private.can_access_store(s.store_id)
      group by d.session_id, d.draft_key
    ) cart
  ), '[]'::jsonb);
end; $$;
revoke all on function public.staff_list_cash_carts() from public, anon;
grant execute on function public.staff_list_cash_carts() to authenticated;

create or replace function public.staff_force_release_abandoned_cash_draft(target_session_id uuid, target_draft_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); store uuid; r record; released int := 0; stalest timestamptz;
begin
  select store_id into store from public.cash_sessions where id = target_session_id for update;
  if actor is null or not private.is_staff() or store is null or not coalesce(private.can_access_store(store), false) then
    raise exception 'Acesso não autorizado';
  end if;
  select max(updated_at) into stalest from public.cash_draft_reservations where session_id = target_session_id and draft_key = target_draft_key;
  if stalest is null then return jsonb_build_object('released', 0); end if;
  if stalest >= now() - interval '5 minutes' then
    raise exception 'Este carrinho teve alteração recente e não pode ser considerado abandonado';
  end if;
  for r in select * from public.cash_draft_reservations where session_id = target_session_id and draft_key = target_draft_key order by flavor_id for update loop
    perform 1 from public.flavor_availability where flavor_id = r.flavor_id and service_date = r.service_date for update;
    delete from public.cash_draft_reservations where id = r.id;
    perform private.recalcular_reserva_de_fatias(r.flavor_id, r.service_date);
    released := released + r.quantity;
  end loop;
  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values (actor, 'cash_draft.force_released_abandoned', 'cash_draft_reservation', target_draft_key, jsonb_build_object('session_id', target_session_id, 'released_slices', released));
  return jsonb_build_object('released', released);
end; $$;
revoke all on function public.staff_force_release_abandoned_cash_draft(uuid, text) from public, anon;
grant execute on function public.staff_force_release_abandoned_cash_draft(uuid, text) to authenticated;
