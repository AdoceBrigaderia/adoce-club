-- Sinaliza novas mensagens sem expor a tabela privada da caixa humana.
create or replace function private.enqueue_whatsapp_support_realtime()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.operation_notifications(
    event_type,
    priority,
    title,
    message,
    entity_type,
    entity_id,
    action_url,
    push_status
  ) values (
    'whatsapp.support.message',
    'urgent',
    'Nova mensagem no WhatsApp',
    'Uma nova mensagem aguarda atendimento.',
    'whatsapp_support_thread',
    new.thread_id::text,
    '/operacao?whatsapp=' || new.thread_id::text,
    'not_applicable'
  );
  return new;
end;
$$;

revoke all on function private.enqueue_whatsapp_support_realtime() from public, anon, authenticated;

drop trigger if exists whatsapp_support_messages_realtime on private.whatsapp_support_messages;
create trigger whatsapp_support_messages_realtime
  after insert on private.whatsapp_support_messages
  for each row
  when (new.direction = 'inbound')
  execute function private.enqueue_whatsapp_support_realtime();

