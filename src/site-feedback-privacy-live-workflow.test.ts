import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  new URL(
    "../.github/workflows/permission-matrix-live-homologation.yml",
    import.meta.url,
  ),
  "utf8",
);

describe("privacidade nos ensaios vivos da homologação", () => {
  it("executa os fluxos público e operacional com rollback e preserva evidências", () => {
    expect(workflow).toContain(
      "supabase/tests/site_feedback_privacy_live.sql",
    );
    expect(workflow).toContain(
      "artifacts/security-live/site-feedback-privacy.log",
    );
    expect(workflow).toContain(
      "supabase/tests/privacy_request_operation_live.sql",
    );
    expect(workflow).toContain(
      "artifacts/security-live/privacy-request-operation.log",
    );
    expect(workflow).toContain('grep -Eiq "ROLLBACK"');
    expect(workflow).toContain("SUPABASE_HOMOLOGATION_DB_URL");
    expect(workflow).toContain("TESTAR SOMENTE HOMOLOGACAO");
    expect(workflow).not.toContain("SUPABASE_PRODUCTION_DB_URL");
  });
});
