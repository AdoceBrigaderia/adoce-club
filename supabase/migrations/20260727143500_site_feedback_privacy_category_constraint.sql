begin;

alter table public.site_feedback
  drop constraint if exists site_feedback_category_check;

alter table public.site_feedback
  add constraint site_feedback_category_check
  check (
    category in (
      'problem',
      'complaint',
      'suggestion',
      'compliment',
      'privacy'
    )
  );

commit;
