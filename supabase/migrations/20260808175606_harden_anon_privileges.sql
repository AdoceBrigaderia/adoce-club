do $$
declare item record;
begin
  for item in select quote_ident(n.nspname) || '.' || quote_ident(c.relname) as target
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p','v','m','f')
  loop
    execute format('revoke truncate, delete, references, trigger on %s from anon', item.target);
  end loop;
end $$;
