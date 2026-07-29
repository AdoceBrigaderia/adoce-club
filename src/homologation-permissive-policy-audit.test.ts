import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  new URL(
    "../.github/workflows/homologation-permissive-policy-audit.yml",
    import.meta.url,
  ),
  "utf8",
);
const auditSql = readFileSync(
  new URL(
    "../supabase/tests/homologation_permissive_policy_audit_live.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("auditoria de policies permissivas da homologação", () => {
  it("é manual, vinculada ao SHA exato e isolada no environment homologation", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toMatch(/^\s*(push|pull_request):/m);
    expect(workflow).toContain("environment: homologation");
    expect(workflow).toContain(
      "EXPECTED_BRANCH: reestruturacao/ux-crm-operacao-imagens-v1",
    );
    expect(workflow).toContain("AUDITAR POLICIES SOMENTE HOMOLOGACAO");
    expect(workflow).toContain(
      'test "$(git rev-parse HEAD)" = "$EXPECTED_COMMIT"',
    );
    expect(workflow).toContain("SUPABASE_HOMOLOGATION_DB_URL");
  });

  it("rejeita produção e não possui capacidade de migration ou deploy", () => {
    expect(workflow).toContain("PRODUCTION_REF: uefwywizqhfvvijaopcn");
    expect(workflow).toContain('echo "Referência produtiva rejeitada"');
    expect(workflow).not.toMatch(/db push|migration repair|netlify|deploy --prod/i);
    expect(workflow).not.toContain("SUPABASE_PRODUCTION");
    expect(auditSql).not.toContain("uefwywizqhfvvijaopcn");
  });

  it("classifica duplicidades por tabela, papel, comando e expressão", () => {
    expect(auditSql).toContain("from pg_policies policy");
    expect(auditSql).toContain("cross join lateral unnest(policy.roles)");
    expect(auditSql).toContain("policy.permissive = 'PERMISSIVE'");
    expect(auditSql).toContain("having count(*) > 1");
    expect(auditSql).toContain("critical_anon_write_groups");
    expect(auditSql).toContain("high_authenticated_write_groups");
    expect(auditSql).toContain("exact_duplicate_groups");
    expect(auditSql).toContain("overlapping_expression_groups");
    expect(auditSql).toContain("using_expression_hash");
    expect(auditSql).toContain("check_expression_hash");
  });

  it("é transacional, somente leitura e preserva evidências redigidas", () => {
    expect(auditSql).toMatch(/^\\set ON_ERROR_STOP on/m);
    expect(auditSql).toMatch(/^begin;$/m);
    expect(auditSql).toMatch(/^rollback;$/m);
    expect(auditSql).not.toMatch(
      /^\s*(insert|update|delete|merge|alter|drop|truncate|grant|revoke|create\s+policy|drop\s+policy)\b/im,
    );
    expect(workflow).toContain("live-audit.csv");
    expect(workflow).toContain("audit-sql.sha256");
    expect(workflow).toContain("retention-days: 30");
  });
});
