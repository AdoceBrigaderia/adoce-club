import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const source = readFileSync(new URL("./AccessApp.tsx",import.meta.url),"utf8");
describe("inicialização do serviço do tablet",()=>{
  it("sincroniza a sessão restaurada e renovada, após resolver o login real",()=>{
    expect(source).toContain('surface !== "operation" || session === undefined');
    expect(source).toContain("syncNativeOperationSession(session).catch");
    expect(source).toContain("[surface, session]");
    expect(source).not.toContain("homologationFakeEnabled");
  });
});
