import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const operationSource = readFileSync(new URL("./AccessApp.tsx", import.meta.url), "utf8");
const accountActionSource = readFileSync(
  new URL("../netlify/functions/customer-account-action.ts", import.meta.url),
  "utf8",
);
const accountActionRpcSource = readFileSync(
  new URL("../supabase/migrations/20260904210000_customer_account_action_rpc.sql", import.meta.url),
  "utf8",
);

describe("administração segura de membros", () => {
  it("oferece exclusão imediata e não mostra cadastros anonimizados", () => {
    expect(operationSource).toContain("Excluir cadastro");
    expect(operationSource).toContain('deleteCustomerConfirmation.trim().toUpperCase() !== "EXCLUIR"');
    expect(operationSource).not.toContain('value="delete_account"');
    expect(operationSource).toContain("isCustomerProfile(profile, staffIds)");
    expect(operationSource).not.toContain('["active", "pending_deletion"].includes(profile.account_status)');
    expect(operationSource).toContain("Quantidade de clientes ativos");
    expect(operationSource).not.toContain("aguardando análise</span>");
  });

  it("remove o acesso e anonimiza os dados pessoais mantendo o histórico", () => {
    // A anonimização e a limpeza dos registros relacionados são atômicas
    // dentro de server_customer_account_action (RPC), não mais ~11
    // gravações soltas na function — ver
    // 20260904210000_customer_account_action_rpc.sql.
    expect(accountActionSource).toContain('rpc("server_customer_account_action"');
    expect(accountActionSource).toContain("deleteUser(profileId, true)");
    expect(accountActionSource).toContain("server_revert_customer_account_action");
    expect(accountActionRpcSource).toContain("'anonymized'");
    expect(accountActionRpcSource).toContain("'Cliente excluído'");
    expect(accountActionRpcSource).toContain("'Cadastro excluído '");
    expect(accountActionRpcSource).toContain("service_requests");
    expect(accountActionRpcSource).toContain("crm_notes");
    expect(accountActionRpcSource).toContain("crm_tasks");
    expect(accountActionRpcSource).toMatch(/for update/i);
  });
});
