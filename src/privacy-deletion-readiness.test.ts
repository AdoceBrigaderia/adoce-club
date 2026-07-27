import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260727180000_privacy_deletion_readiness.sql",
    import.meta.url,
  ),
  "utf8",
);
const policy = readFileSync(
  new URL("../netlify/functions/_shared/bff-rpc-policy.ts", import.meta.url),
  "utf8",
);

describe("revisão segura de exclusão e anonimização", () => {
  it("mantém a etapa reversível e sem apagar dados automaticamente", () => {
    expect(migration).toContain("staff_review_privacy_anonymization");
    expect(migration).toContain("privacy_deletion_ready");
    expect(migration).toContain("privacy_deletion_blockers");
    expect(migration).toContain("status = 'reviewing'");
    expect(migration).not.toContain("delete from auth.users");
    expect(migration).not.toContain("delete from public.profiles");
    expect(migration).not.toContain("update auth.users");
  });

  it("verifica identidade, vínculo, equipe, pedidos, check-ins e fidelidade", () => {
    expect(migration).toContain("privacy_identity_status");
    expect(migration).toContain("request_row.profile_id is null");
    expect(migration).toContain("from public.staff_members");
    expect(migration).toContain("from public.instant_orders");
    expect(migration).toContain("from public.customer_checkins");
    expect(migration).toContain("from public.account_memberships");
    expect(migration).toContain("join public.rewards");
    expect(migration).toContain("for update");
  });

  it("registra auditoria e não expõe o RPC ao anônimo", () => {
    expect(migration).toContain("privacy_request.anonymization_reviewed");
    expect(migration).toContain(
      "revoke all on function public.staff_review_privacy_anonymization(uuid)",
    );
    expect(migration).toContain("from public, anon");
    expect(policy).toContain('"staff_review_privacy_anonymization"');
  });
});
