import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("gestão de membros", () => {
  const source = readFileSync(new URL("./AccessApp.tsx", import.meta.url), "utf8");

  it("conta todos os membros com paginação, sem parar nos primeiros mil cadastros", () => {
    expect(source).toContain("const loadAllProfiles = async () =>");
    expect(source).toContain(".range(from, from + 999)");
    expect(source).toContain('.order("id", { ascending: true })');
    expect(source).not.toContain('.limit(1000)');
    expect(source).not.toContain('.slice(0, 30)');
    expect(source).toContain('clientes exibidos na lista completa');
    expect(source).toContain("isCustomerProfile(profile, staffIds)");
    expect(source).not.toContain('["active", "pending_deletion"].includes(profile.account_status)');
  });

  it("carrega o historico completo do cartao no perfil do cliente", () => {
    expect(source).toContain('const [customerMovements, setCustomerMovements]');
    expect(source).toContain('.eq("track_id", track.id)');
    expect(source).toContain('.range(from, from + 499)');
    expect(source).toContain('.order("id", { ascending: false })');
    expect(source).toContain('Histórico de lançamentos');
  });

  it("mostra somente a quantidade de clientes ativos na tela de atendimento", () => {
    expect(source).toContain('type MemberStatusFilter = "all" | "active" | "deactivated" | "pending"');
    expect(source).toContain('statusFilter === "pending"');
    expect(source).toContain('profile.account_status === "pending_deletion"');
    expect(source).toContain('aria-label="Quantidade de clientes ativos"');
    expect(source).toContain('showCustomersByStatus("active")');
    expect(source).not.toContain('showCustomersByStatus("pending")');
    expect(source).not.toContain('<span>aguardando análise</span>');
    expect(source).toContain('scrollIntoView({ behavior: "smooth", block: "start" })');
    expect(source).toContain("Ver lista completa");
  });

  it("prioriza as acoes, depois o historico e por ultimo seguranca e privacidade", () => {
    const styles = readFileSync(new URL("./access-app.css", import.meta.url), "utf8");
    expect(styles).toContain('.operation-customer .operation-actions { order: 3; }');
    expect(styles).toContain('.operation-customer .customer-movement-history { order: 4; }');
    expect(styles).toContain('.operation-customer .customer-more-options { order: 5; }');
    expect(styles).toContain('.operation-customer .customer-account-compact { order: 6; }');
  });

  it("exige confirmação explícita antes de excluir o cadastro", () => {
    expect(source).toContain("Aguardando decisão da Adoce: excluir ou reativar");
    expect(source).toContain("Excluir cadastro");
    expect(source).toContain('deleteCustomerConfirmation.trim().toUpperCase() !== "EXCLUIR"');
    expect(source).not.toContain('value="delete_account"');
  });

  it("mantém senha como acesso principal da operação", () => {
    expect(source).toContain('surface === "operation" ? "Entrar com senha"');
    expect(source).toContain(
      "await signInWithStaffPhonePassword(phone, password, rememberLogin)",
    );
  });
});
