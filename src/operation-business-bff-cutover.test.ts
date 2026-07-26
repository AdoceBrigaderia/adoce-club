import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const hub = readFileSync(new URL("./OperationBusinessHub.tsx", import.meta.url), "utf8");
const workspace = readFileSync(
  new URL("./OperationBusinessStructureBff.tsx", import.meta.url),
  "utf8",
);

describe("corte BFF da estrutura operacional", () => {
  it("restaura sessão somente pelo BFF", () => {
    expect(hub).toContain("getBffSession()");
    expect(hub).toContain('next.user.surface !== "operation"');
    expect(hub).not.toContain("requireSupabase");
    expect(hub).not.toContain("auth.getSession");
    expect(hub).not.toContain("Session");
  });

  it("executa todas as operações do caixa pelo proxy BFF", () => {
    expect(workspace).toContain('bffRpc<Workspace>("staff_get_business_workspace")');
    expect(workspace).toContain('bffRpc("staff_open_cash_session"');
    expect(workspace).toContain('bffRpc("staff_record_cash_movement"');
    expect(workspace).toContain('bffRpc("staff_close_cash_session"');
    expect(workspace).not.toContain("requireSupabase");
  });

  it("administra lojas, caixas, papéis e capacidades pelo BFF", () => {
    expect(workspace).toContain('bffRpc("manager_upsert_store"');
    expect(workspace).toContain('bffRpc("manager_upsert_cash_register"');
    expect(workspace).toContain('bffRpc("manager_update_staff_member"');
    expect(workspace).toContain('bffRpc("manager_set_staff_capability"');
    expect(workspace).toContain('cashier: "Caixa"');
    expect(workspace).toContain('production: "Produção"');
  });

  it("não depende de access token ou cliente Supabase no navegador", () => {
    expect(`${hub}\n${workspace}`).not.toContain("access_token");
    expect(`${hub}\n${workspace}`).not.toContain("Authorization");
    expect(`${hub}\n${workspace}`).not.toContain("@supabase/supabase-js");
  });
});
