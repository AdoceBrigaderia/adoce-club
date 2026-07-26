import { describe, expect, it } from "vitest";
import {
  normalizeCustomerName,
  shouldNormalizeCustomerName,
} from "./customer-name-normalization";

describe("normalização de nomes de clientes", () => {
  it("corrige caixa alta e espaços duplicados", () => {
    expect(
      normalizeCustomerName("  FRANCISCO   RUBENS PEREIRA BEZERRA FILHO "),
    ).toBe("Francisco Rubens Pereira Bezerra Filho");
  });

  it("mantém partículas brasileiras em minúsculas", () => {
    expect(normalizeCustomerName("MARIA DA SILVA DOS SANTOS")).toBe(
      "Maria da Silva dos Santos",
    );
  });

  it("trata hífen, apóstrofo e sufixo romano", () => {
    expect(normalizeCustomerName("ANA-MARIA D'ÁVILA II")).toBe(
      "Ana-Maria D'Ávila II",
    );
  });

  it("não altera nome já normalizado", () => {
    expect(shouldNormalizeCustomerName("João de Souza")).toBe(false);
    expect(shouldNormalizeCustomerName("JOÃO DE SOUZA")).toBe(true);
  });

  it("preserva string vazia", () => {
    expect(normalizeCustomerName("   ")).toBe("");
  });
});
