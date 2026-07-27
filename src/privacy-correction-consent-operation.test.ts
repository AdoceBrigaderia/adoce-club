import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const operation = readFileSync(
  new URL("./OperationPrivacyRequests.tsx", import.meta.url),
  "utf8",
);
const actionMigration = readFileSync(
  new URL(
    "../supabase/migrations/20260727173000_privacy_correction_consent_actions.sql",
    import.meta.url,
  ),
  "utf8",
);
const resolutionGuard = readFileSync(
  new URL(
    "../supabase/migrations/20260727175000_privacy_resolution_outcome_guard.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("operação de correção e consentimento", () => {
  it("usa BFF e exige identidade e cadastro vinculados", () => {
    expect(operation).toContain('"staff_apply_privacy_name_correction"');
    expect(operation).toContain('"staff_apply_privacy_consent_change"');
    expect(operation).toContain('identityStatus === "verified"');
    expect(operation).toContain("Boolean(item.profile_id)");
    expect(operation).not.toContain("supabase.rpc");
  });

  it("oferece correção de nome com normalização no servidor", () => {
    expect(operation).toContain("Nome completo corrigido");
    expect(operation).toContain("Aplicar correção auditada");
    expect(operation).toContain("requested_full_name: correctionNames[item.id]");
    expect(actionMigration).toContain("private.normalize_person_name(requested_full_name)");
  });

  it("mantém marketing desmarcado e desliga canais ao revogar", () => {
    expect(operation).toContain("marketing: false, whatsapp: false, email: false");
    expect(operation).toContain("Revogar marketing e canais");
    expect(operation).toContain("requested_marketing: options.marketing");
    expect(operation).toContain("requested_whatsapp: options.marketing && options.whatsapp");
    expect(operation).toContain("requested_email: options.marketing && options.email");
    expect(actionMigration).toContain(
      "allow_marketing boolean := coalesce(requested_marketing, false)",
    );
    expect(actionMigration).toContain(
      "allow_whatsapp boolean := coalesce(requested_marketing, false) and coalesce(requested_whatsapp, false)",
    );
    expect(actionMigration).toContain(
      "allow_email boolean := coalesce(requested_marketing, false) and coalesce(requested_email, false)",
    );
    expect(actionMigration).toMatch(/'marketing',\s+allow_marketing,/);
  });

  it("bloqueia resolução genérica até o resultado específico", () => {
    expect(operation).toContain("const outcomeReady");
    expect(operation).toContain("Boolean(item.privacy_action_applied_at)");
    expect(operation).toContain("Boolean(item.privacy_response_delivered_at)");
    expect(operation).toContain("item.privacy_request_type === \"deletion\"");
    expect(resolutionGuard).toContain("Registre a entrega do pacote de dados");
    expect(resolutionGuard).toContain("Execute a alteração solicitada");
    expect(resolutionGuard).toContain("procedimento protegido específico");
  });

  it("mostra a execução persistida e mantém exclusão bloqueada", () => {
    expect(operation).toContain("Ação executada");
    expect(operation).toContain("privacy_action_summary");
    expect(operation).toContain("Exclusão ou anonimização permanece bloqueada");
  });
});
