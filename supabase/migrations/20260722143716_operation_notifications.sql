-- Central interna de alertas da Operação Adoce.
-- Nenhuma informação desta estrutura é disponibilizada aos clientes.

create table if not exists public.operation_notifications (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (char_length(event_type) between 3 and 80),
  priority text not null default 'important' check (priority in ('urgent', 'important', 'informational')),
  title text not null check (char_length(title) between 3 and 140),
  message text not null default '' check (char_length(message) <= 500),
  entity_type text,
  entity_id text,
  action_url text not null default '#operacao',
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  push_status text not null default 'pending' check (push_status in ('pending', 'processing', 'sent', 'failed', 'not_applicable')),
  push_attempts integer not null default 0 check (push_attempts >= 0),
  push_dispatched_at timestamptz,
  push_last_error text,
  created_at timestamptz not null default now()
);

create table if not exists public.operation_notification_reads (
  notification_id uuid not null references public.operation_notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

create table if not exists public.operation_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  active boolean not null default true,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists operation_notifications_created_idx
  on public.operation_notifications(created_at desc);
create index if not exists operation_notifications_push_idx
  on public.operation_notifications(push_status, created_at)
  where push_status in ('pending', 'failed');
create index if not exists operation_notification_reads_user_idx
  on public.operation_notification_reads(user_id, read_at desc);
create index if not exists operation_push_subscriptions_active_idx
  on public.operation_push_subscriptions(active, user_id);

alter table public.operation_notifications enable row level security;
alter table public.operation_notification_reads enable row level security;
alter table public.operation_push_subscriptions enable row level security;

revoke all on public.operation_notifications from public, anon, authenticated;
revoke all on public.operation_notification_reads from public, anon, authenticated;
revoke all on public.operation_push_subscriptions from public, anon, authenticated;

grant select on public.operation_notifications to authenticated;
grant select, insert, update, delete on public.operation_notification_reads to authenticated;
grant select, insert, update, delete on public.operation_push_subscriptions to authenticated;
grant all on public.operation_notifications, public.operation_notification_reads,
  public.operation_push_subscriptions to service_role;

create policy operation_notifications_staff_read
  on public.operation_notifications for select to authenticated
  using ((select private.is_staff()));

create policy operation_notification_reads_staff_read
  on public.operation_notification_reads for select to authenticated
  using ((select private.is_staff()) and user_id = (select auth.uid()));
create policy operation_notification_reads_staff_insert
  on public.operation_notification_reads for insert to authenticated
  with check ((select private.is_staff()) and user_id = (select auth.uid()));
create policy operation_notification_reads_staff_update
  on public.operation_notification_reads for update to authenticated
  using ((select private.is_staff()) and user_id = (select auth.uid()))
  with check ((select private.is_staff()) and user_id = (select auth.uid()));
create policy operation_notification_reads_staff_delete
  on public.operation_notification_reads for delete to authenticated
  using ((select private.is_staff()) and user_id = (select auth.uid()));

create policy operation_push_subscriptions_staff_read
  on public.operation_push_subscriptions for select to authenticated
  using ((select private.is_staff()) and user_id = (select auth.uid()));
create policy operation_push_subscriptions_staff_insert
  on public.operation_push_subscriptions for insert to authenticated
  with check ((select private.is_staff()) and user_id = (select auth.uid()));
create policy operation_push_subscriptions_staff_update
  on public.operation_push_subscriptions for update to authenticated
  using ((select private.is_staff()) and user_id = (select auth.uid()))
  with check ((select private.is_staff()) and user_id = (select auth.uid()));
create policy operation_push_subscriptions_staff_delete
  on public.operation_push_subscriptions for delete to authenticated
  using ((select private.is_staff()) and user_id = (select auth.uid()));

create or replace function private.enqueue_operation_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  notification_event text;
  notification_priority text := 'important';
  notification_title text;
  notification_message text := '';
  notification_entity_type text := TG_TABLE_NAME;
  notification_entity_id text;
  notification_action text := '#operacao';
  product_name text;
begin
  if TG_TABLE_NAME = 'service_requests' then
    notification_entity_id := new.id::text;
    notification_action := '#operacao-pedidos';
    select p.name into product_name
      from public.commercial_products p where p.id = new.product_id;
    if TG_OP = 'INSERT' and new.source = 'website' then
      notification_event := 'service_request.created';
      notification_priority := 'urgent';
      notification_title := 'Nova pré-reserva pelo site';
      notification_message := coalesce(product_name, 'Encomenda') || ' para ' || new.customer_name || '.';
    elsif TG_OP = 'UPDATE' and new.status is distinct from old.status then
      notification_event := 'service_request.status.' || new.status;
      notification_priority := case when new.status in ('confirmed', 'cancelled') then 'urgent' else 'important' end;
      notification_title := case new.status
        when 'confirmed' then 'Pedido confirmado'
        when 'cancelled' then 'Pedido cancelado'
        when 'awaiting_deposit' then 'Pedido aguardando sinal'
        when 'ready' then 'Pedido pronto para entrega'
        else 'Pedido atualizado'
      end;
      notification_message := new.request_number || ' · ' || coalesce(product_name, 'Encomenda') || '.';
    end if;
  elsif TG_TABLE_NAME = 'site_feedback' and TG_OP = 'INSERT' then
    notification_entity_id := new.id::text;
    notification_action := '#operacao-reclamacoes';
    notification_event := 'site_feedback.created';
    notification_priority := case when new.category in ('problem', 'complaint') then 'urgent' else 'important' end;
    notification_title := case new.category
      when 'problem' then 'Cliente relatou um problema'
      when 'complaint' then 'Nova reclamação recebida'
      when 'suggestion' then 'Nova sugestão recebida'
      else 'Novo elogio recebido'
    end;
    notification_message := 'Protocolo ' || new.protocol || ' · abra a Operação para responder.';
  elsif TG_TABLE_NAME = 'profiles' and TG_OP = 'INSERT' then
    notification_entity_id := new.id::text;
    notification_action := '#operacao-membros';
    notification_event := 'profile.created';
    notification_priority := 'important';
    notification_title := 'Novo cadastro no Clube Adoce';
    notification_message := new.full_name || ' acabou de fazer o cadastro.';
  elsif TG_TABLE_NAME = 'pede_junto_groups' then
    notification_entity_id := new.id::text;
    notification_action := '#operacao-pede-junto';
    if TG_OP = 'UPDATE' and new.status = 'submitted' and old.status is distinct from new.status then
      notification_event := 'pede_junto.submitted';
      notification_priority := 'urgent';
      notification_title := 'Novo Pede Junto enviado';
      notification_message := new.name || ' está pronto para separação.';
    elsif TG_OP = 'UPDATE' and new.free_delivery_unlocked_at is not null
      and old.free_delivery_unlocked_at is null then
      notification_event := 'pede_junto.free_delivery_unlocked';
      notification_priority := 'important';
      notification_title := 'Pede Junto chegou a cinco fatias';
      notification_message := new.name || ' liberou a entrega grátis e pode continuar crescendo.';
    end if;
  elsif TG_TABLE_NAME = 'pede_junto_participants' and TG_OP = 'UPDATE'
    and new.status is distinct from old.status then
    notification_entity_id := new.group_id::text;
    notification_action := '#operacao-pede-junto';
    notification_event := 'pede_junto.participant.' || new.status;
    notification_priority := case when new.status = 'payment_pending' then 'urgent' else 'informational' end;
    notification_title := case new.status
      when 'payment_pending' then 'Pagamento individual aguardando'
      when 'paid' then 'Pagamento do Pede Junto confirmado'
      when 'removed' then 'Participante removido do Pede Junto'
      else 'Participante do Pede Junto atualizado'
    end;
    notification_message := 'Abra a Operação para conferir o grupo.';
  end if;

  if notification_event is not null then
    insert into public.operation_notifications(
      event_type, priority, title, message, entity_type, entity_id, action_url, metadata
    ) values (
      notification_event, notification_priority, notification_title,
      notification_message, notification_entity_type, notification_entity_id,
      notification_action, jsonb_build_object('source_table', TG_TABLE_NAME)
    );
  end if;

  return new;
end;
$$;

revoke all on function private.enqueue_operation_notification() from public, anon, authenticated;

drop trigger if exists service_requests_operation_notification on public.service_requests;
create trigger service_requests_operation_notification
  after insert or update of status on public.service_requests
  for each row execute function private.enqueue_operation_notification();

drop trigger if exists site_feedback_operation_notification on public.site_feedback;
create trigger site_feedback_operation_notification
  after insert on public.site_feedback
  for each row execute function private.enqueue_operation_notification();

drop trigger if exists profiles_operation_notification on public.profiles;
create trigger profiles_operation_notification
  after insert on public.profiles
  for each row execute function private.enqueue_operation_notification();

drop trigger if exists pede_junto_groups_operation_notification on public.pede_junto_groups;
create trigger pede_junto_groups_operation_notification
  after update of status, free_delivery_unlocked_at on public.pede_junto_groups
  for each row execute function private.enqueue_operation_notification();

drop trigger if exists pede_junto_participants_operation_notification on public.pede_junto_participants;
create trigger pede_junto_participants_operation_notification
  after update of status on public.pede_junto_participants
  for each row execute function private.enqueue_operation_notification();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'operation_notifications'
  ) then
    alter publication supabase_realtime add table public.operation_notifications;
  end if;
end;
$$;
