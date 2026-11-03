import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const access = readFileSync(new URL("./AccessApp.tsx", import.meta.url), "utf8");
const commercial = readFileSync(new URL("./OperationCommercialAdmin.tsx", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("./OperationDashboard.tsx", import.meta.url), "utf8");
const content = readFileSync(new URL("./OperationContentAdmin.tsx", import.meta.url), "utf8");
const costs = readFileSync(new URL("./OperationCosts.tsx", import.meta.url), "utf8");
const commerceSettings = readFileSync(new URL("./OperationCommerceSettings.tsx", import.meta.url), "utf8");
const archive = readFileSync(new URL("./OperationArchive.tsx", import.meta.url), "utf8");
const operationStyles = readFileSync(new URL("./operation-v3.css", import.meta.url), "utf8");

describe("arquitetura da Adoce Operação", () => {
  it("reúne busca e lista na mesma área de clientes", () => {
    expect(access).toContain("Clientes & Clube");
    expect(access).not.toContain("<Users /> Membros\n          </button>\n          <button\n            className={view");
    expect(access).toContain("clientes exibidos na lista completa");
    expect(access).toContain("Ver lista completa");
  });

  it("separa compras e estoque da gestão", () => {
    expect(access).toContain('"purchasing_inventory"');
    expect(access).toContain('label: "Compras e Estoque"');
    expect(access).toContain('shortLabel: "Compras"');
    expect(access).toContain('/operacao/compras');
    expect(access).toContain("Hoje");
    expect(access).toContain('label: "Pedidos"');
    expect(access).toContain("Produtos");
    expect(access).toContain("Clientes");
    expect(access).toContain("Configurações");
    expect(readFileSync(new URL("./OperationManagement.tsx", import.meta.url), "utf8")).not.toContain("Custos e fichas");
    expect(access.slice(access.indexOf("function OperationHome"))).not.toContain("Agenda");
    expect(access).not.toContain("Pede Junto");
  });

  it("não repete o cabeçalho antigo de custos dentro de Compras e Estoque", () => {
    expect(costs).not.toContain("Uso interno · proprietários e gerentes");
    expect(costs).not.toContain("<h3>Custos e fichas técnicas</h3>");
    expect(costs).not.toContain("Valores reais cadastrados. Campos ausentes mantêm o cálculo incompleto.");
  });

  it("abre pelo painel orientado a pendências e atalhos", () => {
    expect(access).toContain(': "dashboard"');
    expect(dashboard).toContain("Precisa de atenção");
    expect(dashboard).toContain("operation-dashboard-grid");
    expect(dashboard).toContain("attentionItems");
    expect(dashboard).toContain('from("flavor_availability")');
  });

  it("oferece navegação persistente de aplicativo no celular", () => {
    expect(access).toContain('className="operation-mobile-tabbar"');
    expect(access).toContain('aria-label="Navega');
    expect(access).toContain("Hoje");
    expect(access).toContain('shortLabel: "Pedidos"');
    expect(access).toContain("Produtos");
    expect(access).toContain("Clientes");
    expect(access).toContain("onSettings");
    expect(operationStyles).toContain("position: fixed");
    expect(operationStyles).toContain("grid-template-columns: repeat(5, minmax(0, 1fr))");
  });

  it("prioriza as ações e o histórico antes de segurança no perfil do cliente", () => {
    expect(operationStyles).toContain(".operation-customer > .operation-actions { order: 4; }");
    expect(operationStyles).toContain(".operation-customer > .customer-movement-history { order: 5; }");
    expect(operationStyles).toContain(".operation-customer > .customer-access-help { order: 6; }");
    expect(operationStyles).toContain(".operation-customer > .customer-account-admin { order: 7; }");
  });

  it("mantém Clientes separado e integra o relacionamento aos Pedidos", () => {
    expect(access).toContain('attend: "/operacao/clientes"');
    expect(access).toContain('requests: "/operacao/pedidos?tipo=encomendas"');
    expect(access).toContain('sales: "/operacao/caixa"');
    expect(access).toContain('new URLSearchParams(location.search).get("tipo")');
    expect(access).not.toContain("operacao-relacionamento");
    expect(commercial).toContain('aria-label="Histórico e lembretes do pedido"');
  });

  it("reinicia todas as telas da operação no topo", () => {
    expect(access).toContain("const scrollOperationToTop = useCallback(() =>");
    expect(access).toContain("useLayoutEffect(() =>");
    expect(access).toContain("[view, commercialTab, contentTab, productArea, selected?.profile_id, scrollOperationToTop]");
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
    expect(commercial).toContain('title: "Pedidos"');
    expect(commercial).toContain('title: "Encomendas"');
    expect(commercial).toContain('title: "Catálogo comercial"');
    expect(access).toContain('initialTab="sales"');
    expect(access).toContain('allowedTabs={["sales"]}');
    expect(access).toContain('allowedTabs={["catalog"]}');
    expect(access).toContain('<OperationCommerceSettings area="orders" />');
  });

  it("mantém em Configurações somente ajustes permanentes", () => {
    expect(access).not.toContain('setSettingsTab("history")');
    expect(access).toContain('/operacao/historico');
    expect(access).toContain('view === "history"');
    expect(commerceSettings).toContain('area === "orders"');
    expect(commerceSettings).toContain('Ative a reserva automática para definir uma quantidade mínima.');
    expect(commerceSettings).toContain('Salvo: ${changed.join(", ")}');
  });

  it("prioriza tarefas diárias no menu principal", () => {
    expect(access).toContain('label: "Pedidos", shortLabel: "Pedidos"');
    expect(access).not.toContain('label: "Histórico", shortLabel: "Histórico"');
    expect(access).not.toContain('label: "Configurações", shortLabel: "Ajustes"');
    expect(access).toContain('onSettings={() => void openView("settings")}');
  });

  it("protege e pagina o histórico operacional", () => {
    expect(archive).toContain("maskPhoneInText");
    expect(archive).toContain("recordsPerPage = 40");
    expect(archive).toContain('aria-label="Páginas do histórico"');
  });
});
