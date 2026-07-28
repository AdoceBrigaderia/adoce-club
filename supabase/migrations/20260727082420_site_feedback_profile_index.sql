begin;

create index if not exists site_feedback_profile_id_idx
  on public.site_feedback (profile_id)
  where profile_id is not null;

commit;
