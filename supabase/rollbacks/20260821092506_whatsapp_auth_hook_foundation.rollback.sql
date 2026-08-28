begin;

drop function if exists public.server_record_whatsapp_auth_delivery(
  text,text,text,text,text,text,text,integer
);
drop function if exists public.server_has_pending_whatsapp_auth_request(text);
drop function if exists public.server_check_whatsapp_auth_request(uuid,text,boolean);
drop function if exists public.server_register_whatsapp_auth_request(
  uuid,text,timestamptz,uuid
);

drop table if exists private.auth_delivery_attempts;
drop table if exists private.whatsapp_auth_requests;

commit;
