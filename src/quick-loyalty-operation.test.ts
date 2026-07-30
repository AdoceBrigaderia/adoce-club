import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OPERATION_RPC_ALLOWLIST } from "../netlify/functions/_shared/bff-rpc-policy";

const source = readFileSync(
  new URL("./OperationQuickLoyalty.tsx", import.meta.url),
  "utf8",
);
const hub = readFileSync(
  new URL("./OperationBusinessHub.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("./operation-quick-loyalty.css", import.meta.url),
  "utf8",
);

describe("fidelidade rápida na operação", () => {
  it("usa somente RPCs protegidos pelo BFF", () => {
    expect(OPERATION_RPC_ALLOWLIST).toContain("staff_adjust_loyalty_stamps");
    expect(source).toContain('"staff_search_customers"');
    expect(source).toContain('"staff_adjust_loyalty_stamps"');
    expect(source).not.toContain("requireSupabase");
    expect(source).not.toContain("Authorization");
  });

  it("permite inclusão e remoção sem depender de venda ou caixa", () => {
    expect(source).toContain("[1, 2, 3]");
    expect(source).toContain("[-1, -2, -3]");
    expect(source).toContain("Quantidade livre");
    expect(source).not.toContain("cash_session");
    expect(source).not.toContain("order_id");
  });

  it("gera uma chave de idempotência por ação", () => {
    expect(source).toContain("crypto.randomUUID()");
    expect(source).toContain("operation_key: operationKey");
  });

  it("fica disponível diretamente na central operacional", () => {
    expect(hub).toContain("<OperationQuickLoyalty />");
    expect(hub.indexOf("<OperationQuickLoyalty />")).toBeLessThan(
      hub.indexOf("<OperationBusinessStructureBff"),
    );
  });

  it("mantém botões grandes para uso em celular e tablet", () => {
    expect(styles).toContain("min-height:58px");
    expect(styles).toContain("min-height:62px");
    expect(styles).toContain("min-height:68px");
  });
});
