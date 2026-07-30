import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

const removedBrowserSurfaces = [
  "AccessApp.tsx",
  "PilotApp.tsx",
  "ProductionRollbackPanel.tsx",
  "CustomerRegistrationPage.tsx",
  "services/auth.ts",
  "customer-account-actions.ts",
  "customer-profile-admin.ts",
  "staff-access-code.ts",
] as const;

const removedServerSurfaces = [
  "../netlify/functions/customer-security-upgrade.ts",
  "../netlify/functions/production-rollback.ts",
] as const;

describe("remoção definitiva das superfícies legadas", () => {
  it("não mantém rotas de demonstração ou rollback na aplicação", () => {
    expect(app).not.toContain("MemberDemo");
    expect(app).not.toContain("OperationDemo");
    expect(app).not.toContain("ProductionRollbackDemo");
    expect(app).not.toContain("PilotApp");
    expect(app).not.toContain("#membro-demo");
    expect(app).not.toContain("#operacao-demo");
    expect(app).not.toContain("#restauracao-demo");
    expect(app).not.toContain("#festival");
  });

  it.each(removedBrowserSurfaces)("remove %s da árvore ativa", (path) => {
    expect(existsSync(new URL(path, import.meta.url))).toBe(false);
  });

  it.each(removedServerSurfaces)("remove o endpoint legado %s", (path) => {
    expect(existsSync(new URL(path, import.meta.url))).toBe(false);
  });

  it("mantém o cadastro real exclusivamente no gateway BFF", () => {
    expect(app).toContain('import("./CustomerRegistrationBffPage")');
    expect(app).not.toContain('import("./CustomerRegistrationPage")');
  });
});
