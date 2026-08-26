begin;

-- The slug trigger runs with the inserting role. Keep the helper private, but
-- allow the two trusted application roles that can insert flavors to execute
-- the deterministic text transformation used by the trigger.
revoke all on function private.flavor_slug_from_name(text)
  from public, anon, authenticated, service_role;

grant execute on function private.flavor_slug_from_name(text)
  to authenticated, service_role;

commit;
