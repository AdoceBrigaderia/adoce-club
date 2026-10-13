create table if not exists private.cash_customer_loyalty_requests (
  operation_key uuid not null,
  actor_id uuid not null references auth.users(id),
  response_payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (operation_key, actor_id)
);
alter table private.cash_customer_loyalty_requests enable row level security;
revoke all on private.cash_customer_loyalty_requests from public, anon, authenticated;

create or replace function public.staff_finalize_cash_sale_with_customer(
  target_session_id uuid,
  target_draft_key text,
  requested_operation_key uuid,
  requested_customer_name text,
  requested_customer_phone text,
  requested_customer_profile_id uuid,
  requested_customer_reward_id uuid,
  requested_items jsonb,
  requested_reward_unit text,
  requested_reward_kind text,
  requested_payment_method text,
  requested_discount jsonb default '{"kind":"none","value":0}'::jsonb,
  requested_payments jsonb default '[]'::jsonb,
  requested_change jsonb default '{}'::jsonb,
  requested_notes text default ''
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  previous jsonb;
  response jsonb;
  v_order_id uuid;
  flavor_id uuid;
  unit_number integer;
  source_item public.instant_order_items%rowtype;
  reward_item_id uuid;
  reward_sauce public.instant_order_item_sauces%rowtype;
  flavor_price numeric(10,2);
  subtotal numeric(10,2);
  user_discount numeric(10,2);
  reward_credit numeric(10,2);
  combined_discount jsonb;
  total_quantity integer;
  paid_quantity integer;
  account_id uuid;
  reward_track uuid;
begin
  if actor is null or not private.is_staff() then raise exception 'Acesso não autorizado'; end if;
  if requested_operation_key is null then raise exception 'Chave de operação inválida'; end if;
  if requested_reward_kind not in ('manual','digital') then raise exception 'Tipo de fidelidade inválido'; end if;
  perform pg_advisory_xact_lock(hashtextextended('cash-customer-loyalty:' || requested_operation_key::text, 0));
  select response_payload into previous from private.cash_customer_loyalty_requests where operation_key=requested_operation_key and actor_id=actor;
  if previous is not null then return previous || jsonb_build_object('idempotent', true); end if;

  flavor_id := nullif(split_part(coalesce(requested_reward_unit,''), ':', 1), '')::uuid;
  unit_number := nullif(split_part(coalesce(requested_reward_unit,''), ':', 2), '')::integer;
  if flavor_id is null or unit_number is null or unit_number < 1 then raise exception 'Escolha a fatia da fidelidade'; end if;
  if not exists(select 1 from jsonb_array_elements(requested_items) item where (item->>'flavor_id')::uuid=flavor_id and unit_number <= (item->>'quantity')::integer) then
    raise exception 'A fatia escolhida não está no carrinho';
  end if;

  select base_price into flavor_price from public.flavors where id=flavor_id and active for share;
  if flavor_price is null then raise exception 'Sabor da fidelidade indisponível'; end if;
  select coalesce(sum(f.base_price * (item->>'quantity')::integer),0), coalesce(sum((item->>'quantity')::integer),0)
  into subtotal,total_quantity from jsonb_array_elements(requested_items) item join public.flavors f on f.id=(item->>'flavor_id')::uuid;
  user_discount := case coalesce(requested_discount->>'kind','none')
    when 'percent' then least(subtotal, round(subtotal * least(greatest(coalesce((requested_discount->>'value')::numeric,0),0),100) / 100,2))
    when 'amount' then least(subtotal, round(greatest(coalesce((requested_discount->>'value')::numeric,0),0),2))
    else 0 end;
  reward_credit := least(flavor_price,16);
  combined_discount := jsonb_build_object('kind','amount','value',least(subtotal,user_discount+reward_credit));

  if requested_reward_kind = 'digital' then
    if requested_customer_profile_id is null or requested_customer_reward_id is null then raise exception 'Identifique o cliente e a recompensa'; end if;
    select membership.account_id,reward.track_id into account_id,reward_track
    from public.rewards reward join public.loyalty_tracks track on track.id=reward.track_id
    join public.account_memberships membership on membership.account_id=track.account_id and membership.active and membership.is_primary
    where reward.id=requested_customer_reward_id and reward.status='available' and membership.profile_id=requested_customer_profile_id for update of reward;
    if account_id is null then raise exception 'A recompensa não pertence ao cliente identificado'; end if;
  elsif requested_reward_kind = 'manual' then
    if requested_customer_profile_id is not null then raise exception 'Fidelidade manual não pode ser usada com cliente identificado'; end if;
  end if;

  response := public.staff_create_manual_sale_in_cash_v6(
    requested_operation_key,target_session_id,target_draft_key,requested_customer_name,requested_customer_phone,
    requested_items,requested_payment_method,combined_discount,requested_payments,requested_notes,requested_change
  );
  v_order_id := (response->>'order_id')::uuid;
  select item.* into source_item from public.instant_order_items item where item.order_id=v_order_id and item.flavor_id=staff_finalize_cash_sale_with_customer.flavor_id and not item.is_reward for update;
  if source_item.id is null or unit_number > source_item.quantity then raise exception 'Não foi possível localizar a fatia escolhida'; end if;
  select * into reward_sauce from public.instant_order_item_sauces where order_item_id=source_item.id and unit_number=staff_finalize_cash_sale_with_customer.unit_number;

  if source_item.quantity = 1 then
    update public.instant_order_items set is_reward = true,unit_price=greatest(flavor_price-16,0),reward_id=case when requested_reward_kind='digital' then requested_customer_reward_id else null end,updated_at=now() where id=source_item.id;
    reward_item_id := source_item.id;
  else
    update public.instant_order_items set quantity = quantity - 1,updated_at=now() where id=source_item.id;
    delete from public.instant_order_item_sauces where order_item_id=source_item.id and unit_number=staff_finalize_cash_sale_with_customer.unit_number;
    update public.instant_order_item_sauces set unit_number=unit_number-1 where order_item_id=source_item.id and unit_number>staff_finalize_cash_sale_with_customer.unit_number;
    insert into public.instant_order_items(order_id,flavor_id,flavor_name,unit_price,quantity,status,is_reward,reward_id)
    values(v_order_id,flavor_id,source_item.flavor_name,greatest(flavor_price-16,0),1,source_item.status,true,case when requested_reward_kind='digital' then requested_customer_reward_id else null end)
    returning id into reward_item_id;
    if reward_sauce.id is not null then
      insert into public.instant_order_item_sauces(order_item_id,unit_number,sauce_id,sauce_name) values(reward_item_id,1,reward_sauce.sauce_id,reward_sauce.sauce_name);
    end if;
  end if;

  paid_quantity := total_quantity - 1;
  if requested_reward_kind = 'digital' then
    perform public.staff_redeem_reward(requested_customer_reward_id,flavor_price>16,greatest(flavor_price-16,0),requested_operation_key::text || ':reward');
    if paid_quantity > 0 then
      perform public.staff_record_purchase(account_id,requested_customer_profile_id,least(paid_quantity,30)::smallint,requested_operation_key::text || ':purchase',null);
    end if;
  end if;
  insert into public.audit_events(actor_user_id,action,entity_type,entity_id,payload)
  values(actor,'cash.customer_loyalty_finalized','instant_order',v_order_id::text,jsonb_build_object('kind',requested_reward_kind,'reward_unit',requested_reward_unit,'paid_quantity',paid_quantity));
  response := response || jsonb_build_object('total',greatest(0,subtotal-user_discount-reward_credit),'loyalty_recorded',requested_reward_kind='digital','reward_item_id',reward_item_id,'paid_slices',paid_quantity);
  insert into private.cash_customer_loyalty_requests(operation_key,actor_id,response_payload) values(requested_operation_key,actor,response);
  return response;
end;
$$;

revoke all on function public.staff_finalize_cash_sale_with_customer(uuid,text,uuid,text,text,uuid,uuid,jsonb,text,text,text,jsonb,jsonb,jsonb,text) from public,anon;
grant execute on function public.staff_finalize_cash_sale_with_customer(uuid,text,uuid,text,text,uuid,uuid,jsonb,text,text,text,jsonb,jsonb,jsonb,text) to authenticated;
