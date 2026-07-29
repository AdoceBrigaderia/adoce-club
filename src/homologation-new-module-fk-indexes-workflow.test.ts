import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  new URL("../.github/workflows/homologation-apply-new-module-fk-indexes.yml", import.meta.url),
  "utf8",
);

describe("workflow dos índices das relações novas", () => {
  it("é manual, isolado e exige commit, backup e confirmação exatos", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toMatch(/^\s*(push|pull_request):/m);
    expect(workflow).toContain("environment: homologation");
    expect(workflow).toContain("APLICAR INDICES NOVOS SOMENTE HOMOLOGACAO");
    expect(workflow).toContain("BACKUP CONFIRMADO");
    expect(workflow).toContain('test "$(git rev-parse HEAD)" = "$EXPECTED_COMMIT"');
  });

  it("executa rollback antes da aplicação e auditoria depois", () => {
    const dryRun = workflow.indexOf("Executar ensaio completo com rollback");
    const apply = workflow.indexOf("Aplicar índices somente na homologação");
    const audit = workflow.indexOf("Executar auditoria viva pós-aplicação");
    expect(dryRun).toBeGreaterThan(0);
    expect(apply).toBeGreaterThan(dryRun);
    expect(audit).toBeGreaterThan(apply);
    expect(workflow).toContain("index_count");
    expect(workflow).toContain('test "$(node -p');
    expect(workflow).toContain("-eq 7");
  });

  it("rejeita produção, comandos destrutivos e qualquer deploy", () => {
    expect(workflow).toContain("PRODUCTION_REF: uefwywizqhfvvijaopcn");
    expect(workflow).toContain('echo "Referência produtiva rejeitada"');
    expect(workflow).toContain("grep -Ei '\\b(drop|truncate|delete)\\b'");
    expect(workflow).not.toMatch(/netlify|deploy --prod|merge_pull_request|db push/i);
    expect(workflow).not.toContain("SUPABASE_PRODUCTION");
  });
});
