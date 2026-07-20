-- Keep one public SELECT policy and separate manager-only write policies.
-- This preserves public catalog reads without evaluating overlapping SELECT rules.
drop policy if exists commercial_segment_media_manager_all
  on public.commercial_segment_media;

drop policy if exists commercial_segment_media_manager_insert
  on public.commercial_segment_media;
create policy commercial_segment_media_manager_insert
  on public.commercial_segment_media for insert to authenticated
  with check ((select private.is_manager()));

drop policy if exists commercial_segment_media_manager_update
  on public.commercial_segment_media;
create policy commercial_segment_media_manager_update
  on public.commercial_segment_media for update to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));

drop policy if exists commercial_segment_media_manager_delete
  on public.commercial_segment_media;
create policy commercial_segment_media_manager_delete
  on public.commercial_segment_media for delete to authenticated
  using ((select private.is_manager()));
