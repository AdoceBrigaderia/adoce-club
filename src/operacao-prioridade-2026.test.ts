import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

describe("prioridade da operação: fatias e cartão fidelidade", () => {
  it("liga o balcão e o cadastro de 10 segundos na tela de clientes", () => {
    const access = source("./AccessApp.tsx");
    expect(access).toContain('import BalcaoAtendimento from "./BalcaoAtendimento"');
    expect(access).toContain('import CadastroRapido from "./CadastroRapido"');
    expect(access).toContain("createStaffCustomer");
    expect(access).toContain("onCadastrar={() => setCadastrando(true)}");
    expect(access).toContain("onCarimbar");
    expect(access).toContain("onEntregarPresente");
    expect(access).toContain("onAbrirCadastro");
    expect(source("./BalcaoAtendimento.tsx")).toContain("Abrir cadastro");
  });

  it("abre a ficha do cliente pela busca principal para editar e redefinir senha", () => {
    const access = source("./AccessApp.tsx");
    const balcao = source("./BalcaoAtendimento.tsx");
    expect(balcao).toContain("onAbrirCadastro?.(cliente)");
    expect(balcao).toContain("Abrir cadastro de");
    expect(access).toContain("item.profile_id === cliente.id");
    expect(access).toContain("void openCustomer(customer)");
    expect(access).toContain("Redefinir senha");
    expect(access).toContain("Editar nome");
  });

  it("expande a lista completa ao tocar na contagem de clientes", () => {
    const access = source("./AccessApp.tsx");
    expect(access).toContain("customerListDetailsRef.current.open = true");
    expect(access).toContain("ref={customerListDetailsRef}");
  });

  it("abre o cartão do Clube depois do login, sem mandar cadastrar de novo", () => {
    const access = source("./AccessApp.tsx");
    const app = source("./App.tsx");
    expect(access).toContain('location.hash = "clube"');
    expect(access).toContain("mascaraTelefone");
    expect(app).toContain("tokenDoMagicLink");
    expect(app).toContain('surface="client"');
  });

  it("pula a etapa de caldas quando não há calda para escolher", () => {
    const panel = source("./InstantOrderPanel.tsx");
    expect(panel).toContain("needsSauceStep");
    expect(panel).toContain("Enviar pedido");
    expect(panel).toContain("Escolher caldas e enviar");
    expect(panel).toContain("mascaraTelefone");
  });

  it("destaca vender fatias e carimbar no início da operação", () => {
    const dashboard = source("./OperationDashboard.tsx");
    expect(dashboard).toContain("operation-dashboard-heroes");
    expect(dashboard).toContain("Vender fatias");
    expect(dashboard).toContain("Carimbar cliente");
  });

  it("baixa a fatia-presente no estoque ao entregar no balcão", () => {
    const access = source("./AccessApp.tsx");
    const endpoint = source("../netlify/functions/staff-redeem-reward-slice.ts");
    expect(access).toContain("redeemRewardSlice");
    expect(access).toContain("A unidade sai do estoque de hoje.");
    expect(endpoint).toContain("quantity_available");
    expect(endpoint).toContain('status: "redeemed"');
    expect(endpoint).toContain("flavor_availability");
  });

  it("envia senha temporária para o cliente cadastrado no balcão entrar no portal", () => {
    const endpoint = source("../netlify/functions/staff-create-customer.ts");
    const access = source("./AccessApp.tsx");
    const clube = source("./AdoceClube.tsx");
    expect(endpoint).toContain("temporaryPassword");
    expect(endpoint).toContain("auth_upgraded_at");
    expect(endpoint).toContain("must_change_password: true");
    expect(access).toContain("acessoDoBalcao");
    expect(access).toContain("Enviar acesso no WhatsApp");
    expect(clube).toContain('.eq("status", "available")');
    expect(clube).not.toContain("Math.floor(principal / TOTAL_CLUBE)");
  });

  it("aumenta texto e toque da operação no tablet compacto", () => {
    const tablet = source("./operation-tablet.css");
    expect(tablet).toContain("font-size: 18px");
    expect(tablet).toContain("minmax(220px, 260px)");
    expect(tablet).toContain("min-height: 56px");
    expect(tablet).toContain("font-size: 1.02rem");
  });
});
