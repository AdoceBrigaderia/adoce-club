import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const hub = readFileSync(
  new URL("./OperationBusinessHub.tsx", import.meta.url),
  "utf8",
);
const gateway = readFileSync(
  new URL("./PasskeyOperationGateway.tsx", import.meta.url),
  "utf8",
);

describe("Central real da operação", () => {
  it("expõe a venda rápida no fluxo autenticado real", () => {
    expect(gateway).toContain(
      'import OperationBusinessHub from "./OperationBusinessHub"',
    );
    expect(gateway).toContain("<OperationBusinessHub />");
    expect(hub).toContain(
      'import OperationManualSale from "./OperationManualSale"',
    );
    expect(hub).toContain("<OperationManualSale />");
  });

  it("prioriza atendimento rápido antes dos módulos gerenciais", () => {
    const checkIns = hub.indexOf("<OperationCustomerCheckIns />");
    const sale = hub.indexOf("<OperationManualSale />");
    const loyalty = hub.indexOf("<OperationQuickLoyalty />");
    const reports = hub.indexOf("<OperationReports />");
    const structure = hub.indexOf("<OperationBusinessStructureBff");

    expect(checkIns).toBeGreaterThan(-1);
    expect(sale).toBeGreaterThan(checkIns);
    expect(loyalty).toBeGreaterThan(sale);
    expect(reports).toBeGreaterThan(loyalty);
    expect(structure).toBeGreaterThan(reports);
  });

  it("mantém a operação real no BFF, sem cliente Supabase no hub", () => {
    for (const marker of [
      "requireSupabase",
      "@supabase/supabase-js",
      "auth.setSession",
      "auth.getSession",
      "localStorage",
      "sessionStorage",
      "Authorization",
    ]) {
      expect(hub).not.toContain(marker);
      expect(gateway).not.toContain(marker);
    }
    expect(hub).toContain('from "./services/bff-auth"');
    expect(gateway).toContain('from "./services/bff-auth"');
  });
});
