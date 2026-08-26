import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const access = readFileSync(new URL("./AccessApp.tsx", import.meta.url), "utf8");
const commercial = readFileSync(new URL("./OperationCommercialAdmin.tsx", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("./OperationDashboard.tsx", import.meta.url), "utf8");
const content = readFileSync(new URL("./OperationContentAdmin.tsx", import.meta.url), "utf8");
const operationStyles = readFileSync(new URL("./operation-v3.css", import.meta.url), "utf8");

describe("arquitetura da Adoce Operação", () => {
  it("reúne busca e lista na mesma área de clientes", () => {
    expect(access).toContain("Clientes & Clube");
    expect(access).not.toContain("<Users /> Membros\n          </button>\n          <button\n            className={view");
    expect(access).toContain("clientes cadastrados");
  });

  it("separa os galhos principais da operação", () => {
    expect(access).toContain("Visão geral");
    expect(access).toContain("Clientes e fidelidade");
    expect(access).toContain("Caixa e pedidos");
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

  it("oferece navegação persistente de aplicativo no celular", () => {
    expect(access).toContain('className="operation-mobile-tabbar"');
    expect(access).toContain('aria-label="Navega');
    expect(access).toContain("Início");
    expect(access).toContain("Vendas");
    expect(access).toContain("Agenda");
    expect(access).toContain("Clientes");
    expect(access).toContain("Mais");
    expect(operationStyles).toContain("position: fixed");
    expect(operationStyles).toContain("grid-template-columns: repeat(5, minmax(0, 1fr))");
  });

  it("prioriza as ações e o histórico antes de segurança no perfil do cliente", () => {
    expect(operationStyles).toContain(".operation-customer > .operation-actions { order: 4; }");
    expect(operationStyles).toContain(".operation-customer > .customer-movement-history { order: 5; }");
    expect(operationStyles).toContain(".operation-customer > .customer-access-help { order: 6; }");
    expect(operationStyles).toContain(".operation-customer > .customer-account-admin { order: 7; }");
  });

  it("mantém rotas distintas para Clube e relacionamento de encomendas", () => {
    expect(access).toContain('attend: "#operacao-clientes"');
    expect(access).toContain('crm: "#operacao-relacionamento"');
    expect(access).toContain('location.hash.includes("operacao-relacionamento")');
  });

  it("reinicia todas as telas da operação no topo", () => {
    expect(access).toContain("const scrollOperationToTop = useCallback(() =>");
    expect(access).toContain("useLayoutEffect(() =>");
    expect(access).toContain("[view, commercialTab, contentTab, selected?.profile_id, scrollOperationToTop]");
    expect(access).toContain('window.history.scrollRestoration = "manual"');
    expect(access).toContain('window.addEventListener("pageshow", resetOnPageShow)');
  });

  it("conta no painel somente os mesmos perfis exibidos na lista de clientes", () => {
    expect(dashboard).toContain("countCustomerProfiles(profiles.data || [], staffIds)");
    expect(access).toContain("isCustomerProfile(profile, staffIds)");
    expect(dashboard).toContain("loadAllProfiles()");
    expect(dashboard).not.toContain('from("profiles").select("id", { count: "exact", head: true })');
  });

  it("leva o alerta de estoque baixo diretamente à disponibilidade filtrada", () => {
    expect(dashboard).toContain('onNavigate("low-stock")');
    expect(dashboard).not.toContain('onNavigate("catalog") className={data.lowStock');
    expect(access).toContain('destination === "availability" || destination === "low-stock"');
    expect(access).toContain('setContentAvailabilityFilter(destination === "low-stock" ? "low" : "all")');
    expect(content).toContain("Exibindo somente itens disponíveis com até 3 unidades livres.");
  });

  it("dá contexto próprio a cada fluxo comercial", () => {
    expect(commercial).toContain("tabPresentation");
    expect(commercial).toContain('title: "Caixa e pedidos"');
    expect(commercial).toContain('title: "Pedidos e pré-reservas"');
    expect(commercial).toContain('title: "Vendas e recebimentos"');
  });
});
