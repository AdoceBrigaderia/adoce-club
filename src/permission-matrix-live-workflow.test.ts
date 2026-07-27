import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  new URL(
    "../.github/workflows/permission-matrix-live-homologation.yml",
    import.meta.url,
  ),
  "utf8",
);

const permissionSql = readFileSync(
  new URL("../supabase/tests/permission_matrix_live.sql", import.meta.url),
  "utf8",
);
const rateLimitSql = readFileSync(
  new URL("../supabase/tests/public_endpoint_rate_limit_live.sql", import.meta.url),
  "utf8",
);
const rpcAllowlistSql = readFileSync(
  new URL("../supabase/tests/authenticated_rpc_allowlist_live.sql", import.meta.url),
  "utf8",
);

describe("workflow dos ensaios vivos de segurança", () => {
  it("é exclusivamente manual e exige autorização textual e commit exato", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("TESTAR SOMENTE HOMOLOGACAO");
    expect(workflow).toContain('test "$(git rev-parse HEAD)" = "$EXPECTED_COMMIT"');
    expect(workflow).toContain(
      "ref: reestruturacao/ux-crm-operacao-imagens-v1",
    );
    expect(workflow).not.toMatch(/\bpush:\s*$/m);
    expect(workflow).not.toMatch(/\bpull_request:\s*$/m);
  });

  it("usa somente segredo e ambiente de homologação e bloqueia produção", () => {
    expect(workflow).toContain("environment: homologation");
    expect(workflow).toContain("secrets.SUPABASE_HOMOLOGATION_DB_URL");
    expect(workflow).toContain("vars.ADOCE_HOMOLOGATION_SUPABASE_REF");
    expect(workflow).toContain("vars.ADOCE_PRODUCTION_SUPABASE_REF");
    expect(workflow).toContain('test "$HOMOLOGATION_REF" != "$PRODUCTION_REF"');
    expect(workflow).toContain("Referência de produção detectada e bloqueada");
    expect(workflow).not.toContain("SUPABASE_PRODUCTION_DB_URL");
  });

  it("executa todos os ensaios com interrupção no primeiro erro", () => {
    expect(workflow).toContain("--set=ON_ERROR_STOP=1");
    expect(workflow).toContain(
      "--file=supabase/tests/permission_matrix_live.sql",
    );
    expect(workflow).toContain(
      "--file=supabase/tests/public_endpoint_rate_limit_live.sql",
    );
    expect(workflow).toContain(
      "--file=supabase/tests/authenticated_rpc_allowlist_live.sql",
    );
    expect(workflow.match(/grep -Eiq \"ROLLBACK\"/g)).toHaveLength(3);
  });

  it.each([
    ["matriz de permissões", permissionSql],
    ["rate limit", rateLimitSql],
    ["allowlist de RPCs", rpcAllowlistSql],
  ])("preserva rollback integral no ensaio %s", (_label, sql) => {
    expect(sql.trimStart()).toMatch(/^begin;/i);
    expect(sql.trimEnd()).toMatch(/rollback;$/i);
  });

  it("não concede permissão de escrita ao workflow", () => {
    expect(workflow).toMatch(/permissions:\s*\n\s+contents: read/);
    expect(workflow).not.toMatch(/contents:\s*write/);
    expect(workflow).toContain("persist-credentials: false");
  });
});
