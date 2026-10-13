import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-expect-error The release gate is a standalone Node script.
import { requiredOperationFeatures, verifyOperationRelease } from "../scripts/verify-operation-release.mjs";

describe("bloqueio do pacote com regressão operacional", () => {
  function fixture(run: (root: string) => void) {
    const root = mkdtempSync(join(tmpdir(), "adoce-release-test-"));
    try {
      mkdirSync(join(root, "assets"));
      writeFileSync(join(root, "index.html"), '<script src="/assets/index.js"></script>');
      run(root);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
  it("rejeita a versão simplificada mesmo com um pacote antigo completo solto", () => fixture(root => {
    writeFileSync(join(root, "assets/index.js"), '"manager_get_costing_technical_workspace"');
    writeFileSync(join(root, "assets/old.js"), JSON.stringify(requiredOperationFeatures));
    expect(() => verifyOperationRelease(root)).toThrow("PUBLICAÇÃO BLOQUEADA");
  }));
  it("aceita os recursos alcançáveis por carregamento separado", () => fixture(root => {
    writeFileSync(join(root, "assets/index.js"), 'import("./operation.js")');
    writeFileSync(join(root, "assets/operation.js"), JSON.stringify(requiredOperationFeatures));
    expect(verifyOperationRelease(root).features).toBe(requiredOperationFeatures.length);
  }));
  it("bloqueia a perda de qualquer recurso obrigatório", () => fixture(root => {
    for (const missing of requiredOperationFeatures) {
      writeFileSync(join(root, "assets/index.js"), JSON.stringify(requiredOperationFeatures.filter((feature: string) => feature !== missing)));
      expect(() => verifyOperationRelease(root)).toThrow(missing);
    }
  }));
});
