create or replace function private.enqueue_whatsapp_support_realtime()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.operation_notifications(event_type,priority,title,message,entity_type,entity_id,action_url,push_status)
 values('whatsapp.support.message',case when new.direction='inbound' then 'urgent' else 'informational' end,
 case when new.direction='inbound' then 'Nova mensagem no WhatsApp' else 'Conversa atualizada' end,
 case when new.direction='inbound' then 'Uma nova mensagem aguarda atendimento.' else 'O histórico da conversa foi atualizado.' end,
 'whatsapp_support_thread',new.thread_id::text,'/operacao/caixa?whatsapp='||new.thread_id::text,'not_applicable');
 return new;
end; $$;
