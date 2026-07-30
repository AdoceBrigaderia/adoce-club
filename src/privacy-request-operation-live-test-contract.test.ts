import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const liveTest = readFileSync(
  new URL("../supabase/tests/privacy_request_operation_live.sql", import.meta.url),
  "utf8",
);
const typesLiveTest = readFileSync(
  new URL("../supabase/tests/privacy_request_types_sla_live.sql", import.meta.url),
  "utf8",
);
const workflow = readFileSync(
  new URL(
    "../.github/workflows/permission-matrix-live-homologation.yml",
    import.meta.url,
  ),
  "utf8",
);

describe("ensaio vivo da operação de privacidade", () => {
  it("usa identidade de homologação, valida listagem, atualização e auditoria", () => {
    expect(liveTest).toContain("from public.staff_members");
    expect(liveTest).toContain("staff_list_privacy_requests");
    expect(liveTest).toContain("staff_update_privacy_request");
    expect(liveTest).toContain("privacy_request.updated");
    expect(liveTest).toContain("privacy_request_type");
    expect(liveTest).toContain("privacy_due_at");
    expect(liveTest).toContain("privacy_resolved_at");
    expect(liveTest).toContain("has_function_privilege");
    expect(liveTest).toContain("'anon'");
  });

  it("valida idempotência, tipo, prazo, outbox e bloqueio ao navegador", () => {
    expect(typesLiveTest).toContain("repeated_result");
    expect(typesLiveTest).toContain("'access'");
    expect(typesLiveTest).toContain("interval '14 days'");
    expect(typesLiveTest).toContain("interval '16 days'");
    expect(typesLiveTest).toContain("em torno de 15 dias");
    expect(typesLiveTest).toContain("'business.privacidade'");
    expect(typesLiveTest).toContain("'unknown'");
    expect(typesLiveTest).toContain("has_function_privilege");
    expect(typesLiveTest).toContain("'authenticated'");
  });

  it("inclui os dois ensaios no workflow protegido de homologação", () => {
    expect(workflow).toContain("privacy_request_operation_live.sql");
    expect(workflow).toContain("privacy_request_types_sla_live.sql");
    expect(workflow).toContain("environment: homologation");
    expect(workflow).toContain("TESTAR SOMENTE HOMOLOGACAO");
    expect(workflow).toContain('grep -Eiq "ROLLBACK"');
  });

  it("não fixa usuário e desfaz todos os dados temporários", () => {
    expect(liveTest).toContain("actor_id uuid");
    expect(liveTest).toContain("set_config('request.jwt.claim.sub'");
    expect(liveTest).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
    );
    expect(liveTest.trimStart()).toMatch(/^begin;/);
    expect(liveTest.trimEnd()).toMatch(/rollback;$/);
    expect(typesLiveTest.trimStart()).toMatch(/^begin;/);
    expect(typesLiveTest.trimEnd()).toMatch(/rollback;$/);
  });
});
