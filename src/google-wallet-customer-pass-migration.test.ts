import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260727024458_google_wallet_customer_pass.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("migration do cartão Google Wallet", () => {
  it("mantém tabela sem acesso direto do navegador", () => {
    expect(migration).toContain(
      "alter table public.customer_wallet_passes enable row level security",
    );
    expect(migration).toContain(
      "revoke all on table public.customer_wallet_passes from public, anon, authenticated",
    );
  });

  it("prepara o passe somente para o usuário autenticado", () => {
    expect(migration).toContain(
      "create or replace function public.customer_prepare_google_wallet_pass()",
    );
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("current_user_id uuid := (select auth.uid())");
    expect(migration).toContain(
      "revoke all on function public.customer_prepare_google_wallet_pass() from public, anon",
    );
    expect(migration).toContain(
      "grant execute on function public.customer_prepare_google_wallet_pass() to authenticated",
    );
  });

  it("usa identificador opaco e registra auditoria", () => {
    expect(migration).toContain(
      "object_suffix := 'customer_' || replace(current_user_id::text, '-', '')",
    );
    expect(migration).toContain("customer.google_wallet_pass_prepared");
    expect(migration).toContain("generation_count");
    expect(migration).not.toContain("phone_e164");
  });
});
