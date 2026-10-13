-- Preserve the export, authorization and historical-day behavior.
-- A day with a recorded closing is available immediately, including today.
do $migration$
declare definition text;
begin
 select pg_get_functiondef('public.topoint_financial_export(text,date,date)'::regprocedure) into definition;
 if position('closed:=d<(now() at time zone ''America/Fortaleza'')::date and not exists' in definition)=0 then
  raise exception 'Unexpected export definition; inspect before applying';
 end if;
 definition:=replace(definition,
  'closed:=d<(now() at time zone ''America/Fortaleza'')::date and not exists',
  'closed:=(d<(now() at time zone ''America/Fortaleza'')::date or exists(select 1 from public.cash_sessions c where (c.opened_at at time zone ''America/Fortaleza'')::date=d and c.status=''closed'' and c.closed_at is not null)) and not exists');
 execute definition;
end $migration$;
