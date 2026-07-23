import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const access = readFileSync(new URL("./AccessApp.tsx", import.meta.url), "utf8");
const commercial = readFileSync(new URL("./OperationCommercialAdmin.tsx", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("./OperationDashboard.tsx", import.meta.url), "utf8");

describe("arquitetura da Adoce Operação", () => {
  it("reúne busca e lista na mesma área de clientes", () => {
    expect(access).toContain("Clientes & Clube");
    expect(access).not.toContain("<Users /> Membros\n          </button>\n          <button\n            className={view");
    expect(access).toContain("clientes cadastrados");
  });

  it("separa os galhos principais da operação", () => {
    expect(access).toContain("Visão geral");
    expect(access).toContain("Clientes e fidelidade");
    expect(access).toContain("Caixa e pedidos de fatias");
    expect(access).toContain("Encomendas e agenda");
    expect(access).toContain("Produtos e disponibilidade");
    expect(access).toContain("Produtos e serviços");
    expect(access).toContain("Disponibilidade, horários e site");
    expect(access).toContain("Configurações globais");
    expect(access).toContain("Histórico e arquivados");
  });

  it("abre pelo painel orientado a pendências e atalhos", () => {
    expect(access).toContain(': "dashboard"');
    expect(dashboard).toContain("Precisa de atenção");
    expect(dashboard).toContain("O que você quer fazer agora?");
    expect(dashboard).toContain('from("flavor_availability")');
  });

  it("dá contexto próprio a cada fluxo comercial", () => {
    expect(commercial).toContain("tabPresentation");
    expect(commercial).toContain('title: "Caixa e pedidos"');
    expect(commercial).toContain('title: "Pedidos e pré-reservas"');
    expect(commercial).toContain('title: "Vendas e recebimentos"');
  });
});
