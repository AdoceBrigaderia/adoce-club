begin;

revoke all on function public.staff_set_instant_order_reward_item_scoped(uuid, uuid)
  from public, anon, authenticated;
drop function if exists public.staff_set_instant_order_reward_item_scoped(uuid, uuid);

revoke all on function public.staff_mark_existing_instant_order_item_reward(uuid, uuid, integer)
  from public, anon, authenticated;
drop function if exists public.staff_mark_existing_instant_order_item_reward(uuid, uuid, integer);

revoke all on function public.staff_edit_instant_order_items(uuid, jsonb)
  from public, anon, authenticated;
drop function if exists public.staff_edit_instant_order_items(uuid, jsonb);

-- The legacy implementation remains closed, matching the pre-patch production state.

commit;
