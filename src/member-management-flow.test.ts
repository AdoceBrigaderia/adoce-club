import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("gestão de membros", () => {
  const source = readFileSync(new URL("./AccessApp.tsx", import.meta.url), "utf8");

  it("conta todos os membros com paginação, sem parar nos primeiros mil cadastros", () => {
    expect(source).toContain("const loadAllProfiles = async () =>");
    expect(source).toContain(".range(from, from + 999)");
    expect(source).not.toContain('.limit(1000)');
  });

  it("diferencia uma solicitação pendente de uma exclusão já realizada", () => {
    expect(source).toContain("Aguardando decisão da Adoce: excluir ou reativar");
    expect(source).toContain("não exclui agora");
    expect(source).toContain('value="delete_account"');
  });

  it("mantém senha como acesso principal da operação", () => {
    expect(source).toContain('surface === "operation" ? "Entrar com senha"');
    expect(source).toContain(
      "await signInWithStaffPhonePassword(phone, password, rememberLogin)",
    );
  });
});
