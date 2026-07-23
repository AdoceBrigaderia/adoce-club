-- Liga pedidos públicos ao Clube pelo celular informado sem expor dados do
-- membro. A resposta só informa se o convite opcional deve ser oferecido.

create or replace function public.submit_instant_order_v4(
  requested_customer_name text,
  requested_customer_phone text,
  requested_items jsonb,
  requested_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  response jsonb;
  created_order public.instant_orders%rowtype;
  linked_profile_id uuid;
  normalized_phone text;
begin
  response := public.submit_instant_order_v2(
    requested_customer_name,
    requested_customer_phone,
    requested_items,
    requested_notes
  );

  if not coalesce((response->>'accepted')::boolean, false) then
    return response;
  end if;

  select * into created_order
  from public.instant_orders
  where order_number = response->>'order_number';

  linked_profile_id := created_order.profile_id;
  normalized_phone := right(regexp_replace(coalesce(requested_customer_phone, ''), '\D', '', 'g'), 11);

  if linked_profile_id is null then
    select profile.id into linked_profile_id
    from public.profiles profile
    where profile.account_status = 'active'
      and right(regexp_replace(coalesce(profile.phone_e164, ''), '\D', '', 'g'), 11) = normalized_phone
    order by profile.created_at
    limit 1;

    if linked_profile_id is not null then
      update public.instant_orders
      set profile_id = linked_profile_id,
          updated_at = now()
      where id = created_order.id
        and profile_id is null;
    end if;
  end if;

  return response || jsonb_build_object(
    'offer_club_invite', linked_profile_id is null
  );
end;
$$;

revoke all on function public.submit_instant_order_v4(text,text,jsonb,text)
  from public, anon, authenticated;
grant execute on function public.submit_instant_order_v4(text,text,jsonb,text)
  to anon, authenticated;
