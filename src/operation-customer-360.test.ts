import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OPERATION_RPC_ALLOWLIST } from "../netlify/functions/_shared/bff-rpc-policy";

const source = readFileSync(
  new URL("./OperationCustomer360.tsx", import.meta.url),
  "utf8",
);
const hub = readFileSync(
  new URL("./OperationBusinessHub.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("./operation-customer-360.css", import.meta.url),
  "utf8",
);

describe("CRM Cliente 360 na operação", () => {
  it("usa somente RPCs permitidos pelo BFF", () => {
    expect(OPERATION_RPC_ALLOWLIST).toContain("staff_get_customer_360");
    expect(OPERATION_RPC_ALLOWLIST).toContain("staff_add_customer_crm_note");
    expect(OPERATION_RPC_ALLOWLIST).toContain("staff_set_customer_crm_tag");
    expect(source).toContain('bffRpc<Customer360>("staff_get_customer_360"');
    expect(source).not.toContain("requireSupabase");
    expect(source).not.toContain("Authorization");
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("sessionStorage");
  });

  it("reúne dados, pedidos, carimbos, visitas, notas e etiquetas", () => {
    expect(source).toContain("Dados, carimbos, pedidos, preferências, check-ins e anotações");
    expect(source).toContain("recent_orders");
    expect(source).toContain("recent_movements");
    expect(source).toContain("recent_checkins");
    expect(source).toContain("Anotações internas");
    expect(source).toContain("Etiquetas rápidas");
  });

  it("fica diretamente disponível na Central da Operação", () => {
    expect(hub).toContain('import OperationCustomer360 from "./OperationCustomer360"');
    expect(hub).toContain("<OperationCustomer360 />");
    expect(hub.indexOf("<OperationCustomer360 />")).toBeLessThan(
      hub.indexOf("<OperationBusinessStructureBff"),
    );
  });

  it("mantém áreas de toque grandes em celular e tablet", () => {
    expect(styles).toContain("min-height:66px");
    expect(styles).toContain("min-height:58px");
    expect(styles).toContain("@media(max-width:720px)");
    expect(styles).toContain("@media(max-width:460px)");
  });
});
