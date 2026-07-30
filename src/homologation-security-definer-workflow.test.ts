import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  new URL("../.github/workflows/homologation-security-definer-audit.yml", import.meta.url),
  "utf8",
);

describe("workflow de auditoria das RPCs privilegiadas", () => {
  it("é manual, exige SHA exato e usa somente o environment de homologação", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toMatch(/^\s*(push|pull_request):/m);
    expect(workflow).toContain("environment: homologation");
    expect(workflow).toContain("EXPECTED_BRANCH: reestruturacao/ux-crm-operacao-imagens-v1");
    expect(workflow).toContain("AUDITAR RPCS SOMENTE HOMOLOGACAO");
    expect(workflow).toContain('test "$(git rev-parse HEAD)" = "$EXPECTED_COMMIT"');
  });

  it("rejeita produção e não possui capacidade de escrita ou deploy", () => {
    expect(workflow).toContain("PRODUCTION_REF: uefwywizqhfvvijaopcn");
    expect(workflow).toContain('echo "Referência produtiva rejeitada"');
    expect(workflow).not.toMatch(/db push|migration repair|deploy|netlify|merge_pull_request/i);
    expect(workflow).not.toContain("SUPABASE_PRODUCTION");
  });

  it("executa somente a auditoria transacional com rollback", () => {
    expect(workflow).toContain("homologation_security_definer_live.sql");
    expect(workflow).toContain('--file="$LIVE_AUDIT_FILE"');
    expect(workflow).toContain("live-audit.log");
    expect(workflow).toContain("retention-days: 30");
  });
});
