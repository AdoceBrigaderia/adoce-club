begin;

-- Authenticated RPCs below belonged to the removed AccessApp/customer prototype
-- or to order-management routes that are no longer present in the current BFF
-- allowlists. Keep the routines for historical audit and controlled server-side
-- maintenance, but remove direct PostgREST execution from browser sessions.
do $$
declare
  routine record;
begin
  for routine in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as identity_arguments
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'accept_group_invite',
        'accept_referral_invite',
        'complete_forced_password_change',
        'create_group_invite',
        'customer_group_overview',
        'customer_referral_overview',
        'remove_group_member',
        'owner_remove_stamps',
        'staff_confirm_instant_order_payment',
        'staff_duplicate_customer_candidates',
        'staff_finalize_expired_instant_order',
        'staff_finalize_instant_order_direct',
        'staff_instant_order_loyalty_context',
        'staff_record_purchase',
        'staff_redeem_group_reward',
        'staff_redeem_reward',
        'staff_reopen_expired_instant_order',
        'staff_set_instant_order_reward_item',
        'staff_update_instant_order'
      )
  loop
    execute format(
      'revoke all on function %I.%I(%s) from public, anon, authenticated',
      routine.schema_name,
      routine.function_name,
      routine.identity_arguments
    );
    execute format(
      'grant execute on function %I.%I(%s) to service_role',
      routine.schema_name,
      routine.function_name,
      routine.identity_arguments
    );
  end loop;
end;
$$;

-- Regression guard. Any browser privilege here means a retired route was
-- accidentally reopened outside the current BFF policy.
do $$
declare
  exposed_count integer;
begin
  select count(*)
  into exposed_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'accept_group_invite',
      'accept_referral_invite',
      'complete_forced_password_change',
      'create_group_invite',
      'customer_group_overview',
      'customer_referral_overview',
      'remove_group_member',
      'owner_remove_stamps',
      'staff_confirm_instant_order_payment',
      'staff_duplicate_customer_candidates',
      'staff_finalize_expired_instant_order',
      'staff_finalize_instant_order_direct',
      'staff_instant_order_loyalty_context',
      'staff_record_purchase',
      'staff_redeem_group_reward',
      'staff_redeem_reward',
      'staff_reopen_expired_instant_order',
      'staff_set_instant_order_reward_item',
      'staff_update_instant_order'
    )
    and (
      has_function_privilege('anon', p.oid, 'EXECUTE')
      or has_function_privilege('authenticated', p.oid, 'EXECUTE')
    );

  if exposed_count <> 0 then
    raise exception '% unrouted authenticated RPCs remain exposed', exposed_count;
  end if;
end;
$$;

commit;
