begin;

-- The operation UI currently invokes these two staff-only routines directly.
-- Both routines validate auth.uid() and private.is_staff() before reading or
-- changing an order, so restoring EXECUTE does not expose them to anon users.
grant execute on function public.staff_instant_order_loyalty_context(uuid)
  to authenticated;
grant execute on function public.staff_finalize_instant_order_direct(uuid,text,text)
  to authenticated;

-- customer-account-action runs only inside a Netlify Function with the secret
-- service role. Updating the anonymised full_name fires the private name
-- normalisation trigger, whose invoker needs these narrowly scoped privileges.
grant usage on schema private to service_role;
grant execute on function private.capitalize_name_word(text) to service_role;
grant execute on function private.normalize_person_name(text) to service_role;
grant execute on function private.normalize_profile_full_name() to service_role;

commit;
