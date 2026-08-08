update public.site_analytics_events set page_path=coalesce(nullif(split_part(page_path,'#',1),''),'/') || '#[removido]'
where page_path ~* '(access_token|refresh_token|token=|eyJ)';
create or replace function public.record_site_analytics_event(requested_event_id uuid, requested_event_name text, requested_page_path text, requested_properties jsonb default '{}'::jsonb)
returns boolean language plpgsql security definer set search_path to '' as $$
declare safe_properties jsonb; safe_path text;
begin
  if requested_event_id is null or requested_event_name not in ('page_view','whatsapp_click','product_view','prebook_start','prebook_submit','prebook_success','prebook_error','schedule_open','pede_junto_start','club_join_start','instant_order_open','instant_order_start','instant_order_success') or requested_page_path is null or char_length(requested_page_path) not between 1 and 160 then return false; end if;
  safe_path:=requested_page_path;
  if safe_path ~* '(access_token|refresh_token|token=|eyJ)' then safe_path:=split_part(safe_path,'#',1); if safe_path='' then safe_path:='/'; end if; safe_path:=safe_path || '#[removido]'; end if;
  safe_properties:=coalesce(requested_properties,'{}'::jsonb);
  if jsonb_typeof(safe_properties)<>'object' or octet_length(safe_properties::text)>1200 then return false; end if;
  safe_properties:=jsonb_strip_nulls(jsonb_build_object('segment',safe_properties->'segment','product_id',safe_properties->'product_id','product_slug',safe_properties->'product_slug','source',safe_properties->'source','channel',safe_properties->'channel','result',safe_properties->'result','device',safe_properties->'device','quantity',safe_properties->'quantity','checkout_mode',safe_properties->'checkout_mode'));
  insert into public.site_analytics_events(event_id,event_name,page_path,properties) values(requested_event_id,requested_event_name,safe_path,safe_properties) on conflict(event_id) do nothing;
  return true;
end; $$;
