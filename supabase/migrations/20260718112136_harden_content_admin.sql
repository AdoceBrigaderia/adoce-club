begin;

-- Buckets publicos entregam arquivos pela URL publica sem uma politica ampla
-- de listagem. Proprietarios e gerentes continuam com escrita controlada.
drop policy if exists adoce_media_public_read on storage.objects;

create index if not exists notification_campaigns_created_by_idx
  on public.notification_campaigns(created_by);

create index if not exists notification_campaigns_status_schedule_idx
  on public.notification_campaigns(status, scheduled_at);

commit;
