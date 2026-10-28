create or replace function public.staff_release_other_cash_drafts(
  target_session_id uuid,
  preserved_draft_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target_store uuid;
  draft record;
  released_slices integer := 0;
  released_drafts text[] := array[]::text[];
begin
  select store_id into target_store
  from public.cash_sessions
  where id = target_session_id
  for update;

  if actor is null or not private.is_staff()
     or target_store is null or not coalesce(private.can_access_store(target_store), false) then
    raise exception 'Acesso não autorizado';
  end if;
  if preserved_draft_key is null or char_length(btrim(preserved_draft_key)) < 8 then
    raise exception 'Carrinho atual inválido';
  end if;

  for draft in
    select d.*
    from public.cash_draft_reservations d
    where d.session_id = target_session_id
      and d.draft_key <> preserved_draft_key
    order by d.service_date, d.flavor_id, d.id
    for update
  loop
    perform 1 from public.flavor_availability
    where flavor_id = draft.flavor_id and service_date = draft.service_date
    for update;

    delete from public.cash_draft_reservations where id = draft.id;
    perform private.recalcular_reserva_de_fatias(draft.flavor_id, draft.service_date);
    released_slices := released_slices + draft.quantity;
    if not draft.draft_key = any(released_drafts) then
      released_drafts := array_append(released_drafts, draft.draft_key);
    end if;
  end loop;

  insert into public.audit_events(actor_user_id, action, entity_type, entity_id, payload)
  values (actor, 'cash_draft.released_by_staff', 'cash_session', target_session_id::text,
    jsonb_build_object(
      'released_slices', released_slices,
      'released_drafts', cardinality(released_drafts),
      'preserved_draft_key', preserved_draft_key
    ));

  return jsonb_build_object(
    'released_slices', released_slices,
    'released_drafts', cardinality(released_drafts)
  );
end;
$$;

revoke all on function public.staff_release_other_cash_drafts(uuid, text) from public, anon;
grant execute on function public.staff_release_other_cash_drafts(uuid, text) to authenticated;
