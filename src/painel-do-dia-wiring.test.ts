import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const access = readFileSync(new URL("./AccessApp.tsx", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("./OperationDashboard.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("./PainelDoDiaPage.tsx", import.meta.url), "utf8");

describe("religamento do Painel do dia (auditoria funcional)", () => {
  it("fica acessivel em /operacao/painel-do-dia, sem substituir o dashboard atual", () => {
    expect(access).toContain('"/operacao/painel-do-dia"');
    expect(access).toContain("<PainelDoDiaPage");
    expect(dashboard).toContain('onNavigate("painel-do-dia")');
  });

  it("usa a mesma logica de loja aberta/fechada do Adoce Hoje, sem duplicar a regra", () => {
    expect(page).toContain('from "./AdoceHoje"');
    expect(page).toContain("serviceState(");
  });

  it("nao inventa avisos pendentes sem uma fonte de dados real", () => {
    expect(page).toContain("avisosPendentes: 0");
  });
});
