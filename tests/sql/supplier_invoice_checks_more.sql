do $test$
declare first_page jsonb; second_page jsonb; total jsonb; denied boolean:=false;
begin
  first_page:=public.topoint_supplier_invoice_export('test-token',null,null,1);
  second_page:=public.topoint_supplier_invoice_export('test-token',
    (first_page->>'next_updated_at')::timestamptz,(first_page->>'next_id')::uuid,1);
  total:=public.topoint_supplier_invoice_export('test-token',null,null,100);
  if jsonb_array_length(first_page->'items')<>1 or jsonb_array_length(second_page->'items')<>1 or
     first_page#>>'{items,0,source_id}'=second_page#>>'{items,0,source_id}' or
     jsonb_array_length(total->'items')<>2 then
    raise exception 'paginated export duplicated or skipped a note';
  end if;
  begin
    perform public.topoint_supplier_invoice_export('wrong-token',null,null,100);
  exception when insufficient_privilege then denied:=true;
  end;
  if not denied then raise exception 'wrong token accessed export'; end if;
  raise notice 'Adoce export pagination and token checks passed';
end $test$;
