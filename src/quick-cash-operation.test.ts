import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./OperationQuickCash.tsx", import.meta.url),
  "utf8",
);
const hub = readFileSync(
  new URL("./OperationBusinessHub.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("./operation-quick-cash.css", import.meta.url),
  "utf8",
);

describe("caixa rápido na operação", () => {
  it("usa somente RPCs protegidos pelo BFF", () => {
    expect(source).toContain('"staff_get_business_workspace"');
    expect(source).toContain('"staff_record_cash_movement_v2"');
    expect(source).toContain("pendingOperationKey");
    expect(source).not.toContain("requireSupabase");
    expect(source).not.toContain("Authorization");
  });

  it("oferece suprimento, sangria, despesa e ajustes", () => {
    expect(source).toContain('kind: "supply"');
    expect(source).toContain('kind: "withdrawal"');
    expect(source).toContain('kind: "expense"');
    expect(source).toContain('kind: "adjustment_in"');
    expect(source).toContain('kind: "adjustment_out"');
  });

  it("possui atalhos de valor e motivos rápidos", () => {
    expect(source).toContain("[10, 20, 50, 100, 200]");
    expect(source).toContain("Troco adicional");
    expect(source).toContain("Retirada preventiva");
    expect(source).toContain("Correção após conferência");
  });

  it("fica disponível diretamente na central operacional", () => {
    expect(hub).toContain("<OperationQuickCash");
  });

  it("mantém alvos grandes no celular e tablet", () => {
    expect(styles).toContain("min-height:60px");
    expect(styles).toContain("min-height:58px");
    expect(styles).toContain("min-height:62px");
  });
});
