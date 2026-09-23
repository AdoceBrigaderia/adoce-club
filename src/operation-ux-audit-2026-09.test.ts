import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { describeOperationMessage } from "./lib/operation-feedback";
import { paidSliceCount } from "./lib/operation-navigation";

const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const access = read("src/AccessApp.tsx");
const cash = read("src/OperationManualSale.tsx");
const shell = read("src/operation-shell.css");
const v3 = read("src/operation-v3.css");

describe("auditoria de UX da operação (23/09/2026)", () => {
  it("mantém Sair e Instalar sempre acessíveis no cabeçalho", () => {
    expect(access).toContain("<OperationAccountMenu");
    expect(read("src/OperationAccountMenu.tsx")).toContain("Sair / trocar operador");
  });

  it("libera o Caixa para toda a equipe e mostra Configurações só para gerência", () => {
    expect(access).toContain('{view === "orders" && Boolean(role) && (');
    expect(access).toContain("...(canManageOperation");
    expect(access).toContain("operationNavItems.map");
    expect(access).not.toContain('<Settings2 /><span>Config.</span>');
  });

  it("não quebra números e nomes no meio (\"15 / 3\")", () => {
    expect(v3).not.toMatch(/:where\(p, small, strong, span, a, button, label, td, th\) \{\n\s*overflow-wrap: anywhere;/);
    expect(shell).toContain(".operation-member-counts.operation-member-counts-simple");
  });

  it("mantém a cobrança à mão no Caixa em qualquer largura", () => {
    expect(cash).toContain('className="cash-mobile-checkout"');
    expect(read("src/cash-register-layout.css")).toContain("@media(max-width:899px){");
    expect(cash).toContain('className="cash-empty-flavors"');
    expect(cash).not.toContain("window.location.href = `/operacao/clientes");
  });

  it("não usa diálogos nativos do navegador na operação", () => {
    for (const file of ["src/AccessApp.tsx", "src/OperationContentAdmin.tsx", "src/OperationCommercialAdmin.tsx", "src/OperationInstantOrders.tsx"]) {
      const withoutComments = read(file).replace(/\/\/.*$/gm, "");
      expect(withoutComments).not.toMatch(/window\.(confirm|prompt|alert)\(/);
    }
  });

  it("classifica avisos de erro e traduz mensagens técnicas", () => {
    expect(describeOperationMessage("Carimbo registrado.")).toEqual({ kind: "success", text: "Carimbo registrado." });
    expect(describeOperationMessage("Não foi possível abrir o membro.").kind).toBe("error");
    expect(describeOperationMessage("TypeError: Failed to fetch")).toEqual({
      kind: "error",
      text: "Sem conexão com a internet. Confira a rede e tente de novo.",
    });
    expect(describeOperationMessage("new row violates row-level security policy").text).toContain("permissão");
    expect(describeOperationMessage("some unexpected server issue").text).toContain("Detalhe técnico");
    expect(describeOperationMessage("").text).toBe("");
  });

  it("conta só as fatias pagas para lançar carimbos depois da venda", () => {
    expect(
      paidSliceCount({
        instant_order_items: [
          { quantity: 2 },
          { quantity: 1, is_reward: true },
          { quantity: 3, is_reward: false },
        ],
      }),
    ).toBe(5);
    expect(paidSliceCount({})).toBe(0);
  });
});
