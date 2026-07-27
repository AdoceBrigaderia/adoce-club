import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const qualityGate = readFileSync(
  new URL("../.github/workflows/quality-gate.yml", import.meta.url),
  "utf8",
);
const completeGate = readFileSync(
  new URL("../.github/workflows/verify-restructure.yml", import.meta.url),
  "utf8",
);
const playwrightGate = readFileSync(
  new URL("../.github/workflows/playwright-mobile-smoke.yml", import.meta.url),
  "utf8",
);

const hasAutomaticPush = (workflow: string) => /\n\s{2}push:\s*\n/.test(workflow);
const hasAutomaticPullRequest = (workflow: string) =>
  /\n\s{2}pull_request:\s*\n/.test(workflow);

describe("consumo controlado do GitHub Actions", () => {
  it("mantém apenas um gate automático por commit real da branch", () => {
    expect(hasAutomaticPush(qualityGate)).toBe(true);
    expect(hasAutomaticPullRequest(qualityGate)).toBe(false);
    expect(qualityGate).toContain(
      "reestruturacao/ux-crm-operacao-imagens-v1",
    );
    expect(qualityGate).toContain("workflow_dispatch:");
    expect(qualityGate).toContain("paths-ignore:");
    expect(qualityGate).toContain('- "docs/**"');
    expect(qualityGate).toContain('- "**/*.md"');
    expect(qualityGate).toContain("portal-quality-${{ github.ref_name }}");
    expect(qualityGate).toContain("cancel-in-progress: true");
  });

  it("preserva TypeScript, testes, auditorias, build e segurança no gate automático", () => {
    expect(qualityGate).toContain("npm run lint");
    expect(qualityGate).toContain("npm run test");
    expect(qualityGate).toContain("npm run audit:image-library");
    expect(qualityGate).toContain("npm run audit:browser-security");
    expect(qualityGate).toContain("npm run build");
    expect(qualityGate).toContain("npm run verify:security-build");
  });

  it("executa o gate completo somente por ação manual e SHA exato", () => {
    expect(completeGate).toContain("workflow_dispatch:");
    expect(hasAutomaticPush(completeGate)).toBe(false);
    expect(hasAutomaticPullRequest(completeGate)).toBe(false);
    expect(completeGate).toContain("SHA exato do marco que será validado");
    expect(completeGate).toContain("ref: ${{ inputs.commit }}");
    expect(completeGate).toContain(
      'test "$(git rev-parse HEAD)" = "$EXPECTED_COMMIT"',
    );
  });

  it("executa Playwright somente no fechamento manual de um marco visual", () => {
    expect(playwrightGate).toContain("workflow_dispatch:");
    expect(hasAutomaticPush(playwrightGate)).toBe(false);
    expect(hasAutomaticPullRequest(playwrightGate)).toBe(false);
    expect(playwrightGate).toContain("SHA exato do marco visual que será testado");
    expect(playwrightGate).toContain("ref: ${{ inputs.commit }}");
    expect(playwrightGate).toContain("npx playwright test");
  });
});
