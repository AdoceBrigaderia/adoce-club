import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260727093000_backend_only_tables_explicit_deny.sql",
    import.meta.url,
  ),
  "utf8",
);

const backendOnlyTables = [
  "cash_reconciliation_queue",
  "customer_checkins",
  "customer_crm_notes",
  "customer_crm_tags",
  "customer_wallet_passes",
  "outbox_events",
  "pilot_customers",
  "pilot_transactions",
  "staff_quick_sale_favorites",
  "whatsapp_auth_challenges",
  "whatsapp_verification_challenges",
];

describe("bloqueio explícito das tabelas backend-only", () => {
  it("mantém todas as tabelas sensíveis no inventário", () => {
    for (const table of backendOnlyTables) expect(migration).toContain(`'${table}'`);
  });

  it("habilita RLS e remove privilégios diretos", () => {
    expect(migration).toContain("enable row level security");
    expect(migration).toContain(
      "revoke all on table public.%I from public, anon, authenticated",
    );
  });

  it("cria policy deny-all para leitura e escrita pelo navegador", () => {
    expect(migration).toContain("backend_only_no_direct_access");
    expect(migration).toContain("for all to anon, authenticated");
    expect(migration).toContain("using (false) with check (false)");
  });

  it("falha de forma segura se uma tabela esperada estiver ausente", () => {
    expect(migration).toContain("to_regclass");
    expect(migration).toContain("Tabela backend-only esperada não existe");
  });
});
