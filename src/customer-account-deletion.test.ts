import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const operationSource = readFileSync(new URL("./AccessApp.tsx", import.meta.url), "utf8");
const accountActionSource = readFileSync(
  new URL("../netlify/functions/customer-account-action.ts", import.meta.url),
  "utf8",
);

describe("administração segura de membros", () => {
  it("oferece exclusão imediata e não mostra cadastros anonimizados", () => {
    expect(operationSource).toContain('value="delete_account"');
    expect(operationSource).toContain('profile.account_status !== "anonymized"');
    expect(operationSource).toContain("clientes cadastrados");
  });

  it("remove o acesso e anonimiza os dados pessoais mantendo o histórico", () => {
    expect(accountActionSource).toContain("deleteUser(profileId, true)");
    expect(accountActionSource).toContain('account_status: resultingStatus');
    expect(accountActionSource).toContain('customer_name: "Cliente excluído"');
    expect(accountActionSource).toContain("notification_email: null");
  });
});
