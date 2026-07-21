-- Exclusão segura: remove acesso e dados pessoais, preservando somente o
-- identificador operacional necessário para carimbos, pedidos e auditoria.

alter table public.profiles
  drop constraint if exists profiles_account_status_check;

alter table public.profiles
  add constraint profiles_account_status_check
  check (account_status in ('active', 'deactivated', 'pending_deletion', 'merged', 'anonymized'));

alter table public.customer_account_actions
  drop constraint if exists customer_account_actions_action_check;

alter table public.customer_account_actions
  add constraint customer_account_actions_action_check
  check (action in (
    'deactivate', 'reactivate', 'request_deletion', 'mark_duplicate',
    'cancel_deletion', 'delete_account'
  ));

comment on column public.profiles.account_status is
  'anonymized means access and personal data were irreversibly removed while operational history was retained.';
