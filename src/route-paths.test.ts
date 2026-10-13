import { describe, expect, it } from "vitest";
import { pathFromLegacyHash } from "./route-paths";

describe("endereços sem fragmento de página", () => {
  it("converte as entradas antigas da operação e do cliente", () => {
    expect(pathFromLegacyHash("#operacao")).toBe("/operacao");
    expect(pathFromLegacyHash("#operacao-vendas")).toBe("/operacao/vendas");
    expect(pathFromLegacyHash("#minha-conta?view=profile")).toBe("/minha-conta?view=profile");
    expect(pathFromLegacyHash("#adoce-hoje")).toBe("/adoce-hoje");
  });

  it("preserva fragmentos de autenticação que carregam credenciais", () => {
    expect(pathFromLegacyHash("#access_token=segredo&refresh_token=segredo")).toBeNull();
    expect(pathFromLegacyHash("#acesso-direto?email=a%40b.com&code=123456")).toBeNull();
  });
});
