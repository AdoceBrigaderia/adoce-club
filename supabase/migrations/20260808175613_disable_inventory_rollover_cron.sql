do $$ begin
  if exists(select 1 from cron.job where jobid=2) then perform cron.unschedule(2); end if;
end $$;
