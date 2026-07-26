import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260726233500_customer_account_workspace.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("workspace seguro da conta do cliente", () => {
  it("sempre limita os dados ao usuário autenticado", () => {
    expect(migration).toContain("current_user_id uuid := (select auth.uid())");
    expect(migration).toContain("where p.id = current_user_id");
    expect(migration).toContain("membership.profile_id = current_user_id");
    expect(migration).toContain("referral.profile_id = current_user_id");
  });

  it("consolida perfil, fidelidade, consentimentos e histórico", () => {
    expect(migration).toContain("'profile', jsonb_build_object");
    expect(migration).toContain("'loyalty', jsonb_build_object");
    expect(migration).toContain("'consents', coalesce");
    expect(migration).toContain("'preferences', coalesce");
    expect(migration).toContain("'recent_movements', coalesce");
  });

  it("não libera o RPC para público ou anônimo", () => {
    expect(migration).toContain(
      "revoke all on function public.customer_get_account_workspace() from public, anon",
    );
    expect(migration).toContain(
      "grant execute on function public.customer_get_account_workspace() to authenticated",
    );
  });
});
