import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PRODUCTION_APPROVAL_PHRASE,
  validateProductionApproval,
} from "../scripts/production-approval-core.mjs";

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { scripts: Record<string, string> };
const releaseCheck = readFileSync(
  new URL("../scripts/release-check.mjs", import.meta.url),
  "utf8",
);

describe("portão de produção", () => {
  const commit = "0123456789abcdef0123456789abcdef01234567";
  const now = new Date("2026-07-27T03:00:00.000Z");
  const approved = {
    ADOCE_PRODUCTION_APPROVAL: PRODUCTION_APPROVAL_PHRASE,
    ADOCE_PRODUCTION_APPROVED_BY: "Rubens",
    ADOCE_PRODUCTION_COMMIT: commit,
    ADOCE_PRODUCTION_APPROVAL_AT: "2026-07-27T02:30:00.000Z",
    ADOCE_PRODUCTION_BACKUP_CONFIRMED: "sim",
    ADOCE_PRODUCTION_ROLLBACK_CONFIRMED: "sim",
    ADOCE_PRODUCTION_SMOKE_PLAN_CONFIRMED: "sim",
  };

  it("bloqueia por padrão sem qualquer aprovação", () => {
    const result = validateProductionApproval({}, commit, now);
    expect(result.approved).toBe(false);
    expect(result.failures.length).toBeGreaterThanOrEqual(6);
  });

  it("bloqueia aprovação antiga, commit diferente ou plano incompleto", () => {
    expect(
      validateProductionApproval(
        {
          ...approved,
          ADOCE_PRODUCTION_APPROVAL_AT: "2026-07-25T02:30:00.000Z",
        },
        commit,
        now,
      ).approved,
    ).toBe(false);
    expect(
      validateProductionApproval(approved, `${commit}x`, now).approved,
    ).toBe(false);
    expect(
      validateProductionApproval(
        { ...approved, ADOCE_PRODUCTION_BACKUP_CONFIRMED: "não" },
        commit,
        now,
      ).approved,
    ).toBe(false);
  });

  it("libera somente a combinação completa e recente", () => {
    const result = validateProductionApproval(approved, commit, now);
    expect(result.approved).toBe(true);
    expect(result.failures).toEqual([]);
    expect(result.approvedBy).toBe("Rubens");
  });

  it("mantém homologação no gate integral e produção atrás do portão extra", () => {
    expect(packageJson.scripts["release:preview"]).toContain(
      "npm run release:check",
    );
    expect(packageJson.scripts["release:prod"]).toMatch(
      /^node scripts\/production-approval-gate\.mjs && npm run audit:migrations && npm run audit:migration-reconciliation && npm run release:check/,
    );
    expect(releaseCheck).toContain('["run", "verify"]');
  });
});
