begin;

-- Estas tabelas existem para processamento pelo backend, funções transacionais
-- e auditoria. O navegador nunca deve acessá-las diretamente, mesmo quando há
-- uma sessão válida do Supabase. A policy explícita documenta o deny-all e
-- evita que uma futura concessão de tabela enfraqueça essa fronteira.
do $$
declare
  table_name text;
  backend_only_tables constant text[] := array[
    'cash_reconciliation_queue',
    'customer_checkins',
    'customer_crm_notes',
    'customer_crm_tags',
    'customer_wallet_passes',
    'outbox_events',
    'pilot_customers',
    'pilot_transactions',
    'staff_quick_sale_favorites',
    'whatsapp_auth_challenges',
    'whatsapp_verification_challenges'
  ];
begin
  foreach table_name in array backend_only_tables loop
    if to_regclass(format('public.%I', table_name)) is null then
      raise exception 'Tabela backend-only esperada não existe: public.%', table_name;
    end if;

    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    execute format(
      'drop policy if exists backend_only_no_direct_access on public.%I',
      table_name
    );
    execute format(
      'create policy backend_only_no_direct_access on public.%I for all to anon, authenticated using (false) with check (false)',
      table_name
    );
  end loop;
end;
$$;

commit;
