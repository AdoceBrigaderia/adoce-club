begin;

-- The operation screen uses this owner-only RPC for explicit stamp reversals.
-- The function keeps its own auth.uid()/owner/active checks; this grant only
-- restores the authenticated route that the current operation UI requires.
grant execute on function public.owner_remove_stamps(uuid, uuid, smallint, text, text)
  to authenticated;

commit;
