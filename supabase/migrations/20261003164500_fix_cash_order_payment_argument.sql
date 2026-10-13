create or replace function public.staff_submit_cash_order_v1(target_session_id uuid,target_draft_key text,requested_customer_name text,requested_customer_phone text,requested_items jsonb,requested_payment_method text,requested_notes text,requested_reward jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform public.staff_release_cash_draft_reservation(target_session_id,target_draft_key);
 result:=public.staff_submit_instant_order_v5(
   requested_customer_name => requested_customer_name,
   requested_customer_phone => requested_customer_phone,
   requested_items => requested_items,
   requested_notes => requested_notes,
   requested_payment_method => requested_payment_method,
   requested_reward => requested_reward
 );
 if not coalesce((result->>'accepted')::boolean,false) then raise exception '%',coalesce(result->>'message','Não foi possível reservar'); end if;
 return result;
end; $$;
revoke all on function public.staff_submit_cash_order_v1(uuid,text,text,text,jsonb,text,text,jsonb) from public,anon;
grant execute on function public.staff_submit_cash_order_v1(uuid,text,text,text,jsonb,text,text,jsonb) to authenticated;
