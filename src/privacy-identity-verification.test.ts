import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260727160000_privacy_identity_verification.sql",
    import.meta.url,
  ),
  "utf8",
);
const operation = readFileSync(
  new URL("./OperationPrivacyRequests.tsx", import.meta.url),
  "utf8",
);
const bffPolicy = readFileSync(
  new URL("../netlify/functions/_shared/bff-rpc-policy.ts", import.meta.url),
  "utf8",
);

describe("verificação de identidade em solicitações de privacidade", () => {
  it("mantém os dados de verificação restritos à solicitação de privacidade", () => {
    expect(migration.trimStart()).toMatch(/^begin;/);
    expect(migration.trimEnd()).toMatch(/commit;$/);
    expect(migration).toContain("privacy_identity_status");
    expect(migration).toContain("privacy_identity_checked_at");
    expect(migration).toContain("privacy_identity_checked_by");
    expect(migration).toContain("privacy_identity_notes");
    expect(migration).toContain("site_feedback_privacy_identity_check");
    expect(migration).toContain("category <> 'privacy'");
    expect(migration).toContain("privacy_identity_status is null");
  });

  it("exige capacidade interna, bloqueia navegador anônimo e audita a conferência", () => {
    expect(migration).toContain("private.staff_has_any_capability('manage_customers')");
    expect(migration).toContain("for update");
    expect(migration).toContain("'privacy_request.identity_checked'");
    expect(migration).toContain("from public, anon");
    expect(migration).toContain("to authenticated");
    expect(migration).toContain("requested_verification_notes");
    expect(migration).toContain("no máximo 1200 caracteres");
  });

  it("impede resolução de pedidos sensíveis antes da identidade confirmada", () => {
    expect(migration).toContain(
      "previous_row.privacy_request_type in ('access', 'correction', 'deletion', 'consent')",
    );
    expect(migration).toContain(
      "coalesce(previous_row.privacy_identity_status, 'pending') <> 'verified'",
    );
    expect(migration).toContain(
      "Confirme a identidade do solicitante antes de marcar este pedido como resolvido",
    );
    expect(operation).toContain("identityRequiredTypes");
    expect(operation).toContain("const canResolve");
    expect(operation).toContain("!canResolve");
  });

  it("expõe somente o RPC controlado pelo BFF e orienta a equipe sem coletar documento completo", () => {
    expect(bffPolicy).toContain('"staff_verify_privacy_request_identity"');
    expect(operation).toContain('bffRpc("staff_verify_privacy_request_identity"');
    expect(operation).toContain("Identidade confirmada");
    expect(operation).toContain("Não confirmada");
    expect(operation).toContain(
      "Não registre documentos ou códigos completos nesta anotação.",
    );
  });
});
