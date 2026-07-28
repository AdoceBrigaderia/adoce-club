import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const hub = readFileSync("src/OperationBusinessHub.tsx", "utf8");
const center = readFileSync("src/OperationAdminCenter.tsx", "utf8");
const globalSettings = readFileSync("src/OperationGlobalSettingsBff.tsx", "utf8");
const styles = readFileSync("src/operation-admin-center.css", "utf8");
const policy = readFileSync(
  "netlify/functions/_shared/bff-rpc-policy.ts",
  "utf8",
);

describe("central administrativa da operação", () => {
  it("reúne as configurações reais em uma única área para owner e manager", () => {
    expect(hub).toContain('const canConfigureProduction = ["owner", "manager"]');
    expect(hub).toContain("<OperationAdminCenter userId={session.user.id} />");
    expect(center).toContain("Configurações globais");
    expect(center).toContain("Itens e custos");
    expect(center).toContain("Rentabilidade");
    expect(center).toContain("Montagem das tortas");
    expect(center).toContain("Valores das encomendas");
    expect(center).toContain("Lojas, caixas e equipe");
  });

  it("renderiza somente a área administrativa selecionada", () => {
    expect(center).toContain('useState<AdminArea>("global")');
    expect(center).toContain('activeArea === "global"');
    expect(center).toContain('activeArea === "costs"');
    expect(center).toContain('activeArea === "profitability"');
    expect(center).toContain('activeArea === "cakes"');
    expect(center).toContain('activeArea === "history"');
    expect(center).toContain('activeArea === "structure"');
    expect(center).toContain('aria-pressed={activeArea === id}');
  });

  it("move leitura e gravação das regras globais para o BFF com CSRF", () => {
    expect(globalSettings).toContain('bffRpc<CommerceSettings>("staff_get_commerce_settings")');
    expect(globalSettings).toContain('bffRpc<CommerceSettings>("staff_update_commerce_settings"');
    expect(globalSettings).not.toContain("requireSupabase");
    expect(globalSettings).not.toContain("localStorage");
    expect(globalSettings).not.toContain("sessionStorage");
    expect(policy).toContain('"staff_get_commerce_settings"');
    expect(policy).toContain('"staff_update_commerce_settings"');
  });

  it("mantém botões grandes e adaptação para celular e tablet", () => {
    expect(styles).toContain("grid-template-columns: repeat(3");
    expect(styles).toContain("grid-template-columns: repeat(2");
    expect(styles).toContain("grid-template-columns: 1fr");
    expect(styles).toContain("min-height: 76px");
    expect(styles).toContain("min-height: 64px");
    expect(styles).toContain("@media (max-width: 620px)");
  });
});
