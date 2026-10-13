import fs from 'node:fs';
let sql=fs.readFileSync('supabase/migrations/20261011122536_shopping_weekly_schedule.sql','utf8');
sql=sql.slice(sql.indexOf('create function public.manager_update_shopping_week'),sql.indexOf('create function public.manager_copy_shopping_week'))
 .replace('create function','create or replace function')
 .replace("('cakes','daily','extras','stock','selected')","('cakes','daily','extras','stock','selected','quoteUnits','quoteWeight','quotePrice')")
 .replace("requested_group in ('daily','cakes') and amount<>trunc(amount)","requested_group in ('daily','cakes','quoteUnits') and amount<>trunc(amount)")
 .replace(" if requested_group in ('daily','cakes') then"," if requested_group='daily' and amount>1 then raise exception 'Selecione somente uma torta por sabor e dia'; end if;\n if requested_group in ('daily','cakes') then")
 .replace(" saved:=jsonb_set(saved,array[requested_group,requested_key]"," saved:=jsonb_set(saved,array[requested_group],coalesce(saved->requested_group,'{}'::jsonb),true);\n saved:=jsonb_set(saved,array[requested_group,requested_key]");
sql=sql.replace(/\\d/g,'[0-9]').replace(/\\\|/g,'[|]');
sql+='\nrevoke all on function public.manager_update_shopping_week(date,text,text,jsonb) from public,anon;\ngrant execute on function public.manager_update_shopping_week(date,text,text,jsonb) to authenticated;\n';
fs.writeFileSync('supabase/migrations/20261011210500_shopping_tablet_quotes.sql',sql);
