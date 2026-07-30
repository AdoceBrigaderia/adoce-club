begin;

create or replace function public.manager_get_whatsapp_otp_metrics(
  requested_days smallint default 30
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  period_days smallint := greatest(1, least(coalesce(requested_days, 30), 90));
  result jsonb;
begin
  if (select auth.uid()) is null or not private.is_manager() then
    raise exception 'Apenas proprietarios e gestores podem consultar a integracao do WhatsApp';
  end if;

  with scoped as (
    select *
    from public.whatsapp_auth_challenges challenge
    where challenge.created_at >= now() - make_interval(days => period_days)
  ), totals as (
    select
      count(*)::integer as total,
      count(*) filter (where status in ('sent','delivered','read','verified'))::integer as sent_count,
      count(*) filter (where status in ('delivered','read','verified'))::integer as delivered_count,
      count(*) filter (where status = 'read')::integer as read_count,
      count(*) filter (where status = 'verified')::integer as verified_count,
      count(*) filter (where status in ('failed','blocked','expired'))::integer as unsuccessful_count,
      count(*) filter (where status = 'failed')::integer as failed_count
    from scoped
  ), status_summary as (
    select coalesce(jsonb_object_agg(status, amount), '{}'::jsonb) as value
    from (
      select status, count(*)::integer amount
      from scoped
      group by status
      order by status
    ) grouped
  ), purpose_summary as (
    select coalesce(jsonb_object_agg(purpose, amount), '{}'::jsonb) as value
    from (
      select purpose, count(*)::integer amount
      from scoped
      group by purpose
      order by purpose
    ) grouped
  ), daily_summary as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'date', service_date,
      'requested', requested,
      'delivered', delivered,
      'verified', verified,
      'failed', failed
    ) order by service_date), '[]'::jsonb) as value
    from (
      select
        (created_at at time zone 'America/Fortaleza')::date as service_date,
        count(*)::integer as requested,
        count(*) filter (where status in ('delivered','read','verified'))::integer as delivered,
        count(*) filter (where status = 'verified')::integer as verified,
        count(*) filter (where status in ('failed','blocked','expired'))::integer as failed
      from scoped
      group by (created_at at time zone 'America/Fortaleza')::date
      order by service_date
    ) grouped
  ), recent_failures as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'challenge_id', id,
      'purpose', purpose,
      'status', status,
      'provider_error_code', provider_error_code,
      'provider_error_title', provider_error_title,
      'created_at', created_at,
      'failed_at', failed_at
    ) order by coalesce(failed_at, created_at) desc), '[]'::jsonb) as value
    from (
      select id, purpose, status, provider_error_code, provider_error_title, created_at, failed_at
      from scoped
      where status in ('failed','blocked','expired')
      order by coalesce(failed_at, created_at) desc
      limit 10
    ) failures
  )
  select jsonb_build_object(
    'period_days', period_days,
    'total', totals.total,
    'sent_count', totals.sent_count,
    'delivered_count', totals.delivered_count,
    'read_count', totals.read_count,
    'verified_count', totals.verified_count,
    'unsuccessful_count', totals.unsuccessful_count,
    'failed_count', totals.failed_count,
    'delivery_rate', case when totals.sent_count > 0 then round((totals.delivered_count::numeric / totals.sent_count) * 100, 2) else 0 end,
    'verification_rate', case when totals.sent_count > 0 then round((totals.verified_count::numeric / totals.sent_count) * 100, 2) else 0 end,
    'status_counts', status_summary.value,
    'purpose_counts', purpose_summary.value,
    'daily', daily_summary.value,
    'recent_failures', recent_failures.value,
    'generated_at', now()
  ) into result
  from totals, status_summary, purpose_summary, daily_summary, recent_failures;

  return result;
end;
$$;

revoke all on function public.manager_get_whatsapp_otp_metrics(smallint) from public, anon;
grant execute on function public.manager_get_whatsapp_otp_metrics(smallint) to authenticated;

commit;
