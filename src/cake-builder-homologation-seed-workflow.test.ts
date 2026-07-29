import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  new URL("../.github/workflows/homologation-apply-cake-builder-catalog.yml", import.meta.url),
  "utf8",
);

const liveAudit = readFileSync(
  new URL("../supabase/tests/homologation_cake_builder_catalog_live.sql", import.meta.url),
  "utf8",
);

const runbook = readFileSync(
  new URL("../docs/homologation-cake-builder-catalog-runbook.md", import.meta.url),
  "utf8",
);

describe("aplicação do catálogo real do montador na homologação", () => {
  it("é manual, isolada e exige commit, backup e confirmação exatos", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toMatch(/^\s*(push|pull_request):/m);
    expect(workflow).toContain("environment: homologation");
    expect(workflow).toContain("EXPECTED_BRANCH: reestruturacao/ux-crm-operacao-imagens-v1");
    expect(workflow).toContain("HOMOLOGATION_REF: vazozolhbehnriytzcdc");
    expect(workflow).toContain("PRODUCTION_REF: uefwywizqhfvvijaopcn");
    expect(workflow).toContain("APLICAR CATALOGO REAL DO MONTADOR SOMENTE HOMOLOGACAO");
    expect(workflow).toContain("BACKUP CONFIRMADO");
    expect(workflow).toContain("SUPABASE_HOMOLOGATION_DB_URL");
    expect(workflow).toContain('test "$(git rev-parse HEAD)" = "$EXPECTED_COMMIT"');
  });

  it("executa ensaio com rollback antes da aplicação real", () => {
    const dryRunStep = workflow.indexOf("Executar ensaio completo com rollback");
    const applyStep = workflow.indexOf("Aplicar seed real exclusivamente na homologação");
    const auditStep = workflow.indexOf("Executar auditoria viva pós-seed");

    expect(dryRunStep).toBeGreaterThan(0);
    expect(applyStep).toBeGreaterThan(dryRunStep);
    expect(auditStep).toBeGreaterThan(applyStep);
    expect(workflow).toContain("seed.replace(/commit;\\s*$/i, 'rollback;\\n')");
    expect(workflow).toContain("--file=artifacts/cake-builder-catalog/dry-run.sql");
    expect(workflow).toContain('--file="$SEED_FILE"');
    expect(workflow).toContain('--file="$LIVE_AUDIT_FILE"');
  });

  it("não possui capacidade de merge, deploy ou migration produtiva", () => {
    expect(workflow).not.toMatch(/netlify|deploy --prod|merge_pull_request|db push/i);
    expect(workflow).not.toContain("SUPABASE_PRODUCTION");
    expect(workflow).toContain('echo "Referência produtiva rejeitada"');
    expect(workflow).toContain('! grep -R "$PRODUCTION_REF" artifacts/cake-builder-catalog');
  });

  it("audita o catálogo real sem persistir alterações adicionais", () => {
    expect(liveAudit.trimStart()).toMatch(/^\\set ON_ERROR_STOP on/);
    expect(liveAudit).toContain("begin;");
    expect(liveAudit.trimEnd()).toMatch(/rollback;$/);
    expect(liveAudit).toContain("expected_products <> 3");
    expect(liveAudit).toContain("valid_templates <> 3");
    expect(liveAudit).toContain("missing_mass_options <> 0");
    expect(liveAudit).toContain("missing_filling_options <> 0");
    expect(liveAudit).toContain("stale_active_options <> 0");
    expect(liveAudit).toContain("option.placement not in ('cake_layer', 'filling_layer', 'topping')");
    expect(liveAudit).toContain("invalid_toppings <> 0");
    expect(liveAudit).toContain("provisional_values <> 0");
    expect(liveAudit).toContain("pg_advisory_xact_lock");
  });

  it("documenta pré-requisitos, repetição e proibição de produção", () => {
    expect(runbook).toContain("As 22 migrations pendentes precisam estar aplicadas");
    expect(runbook).toContain("SUPABASE_HOMOLOGATION_DB_URL");
    expect(runbook).toContain("Falhas transientes");
    expect(runbook).toContain("repetidas até três vezes");
    expect(runbook).toContain("Este procedimento não:");
    expect(runbook).toContain("acessa o Supabase produtivo");
    expect(runbook).toContain("sem aprovação expressa");
  });
});
