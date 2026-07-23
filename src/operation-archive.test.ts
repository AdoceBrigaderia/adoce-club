import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const archive = readFileSync(new URL("./OperationArchive.tsx", import.meta.url), "utf8");
const commercial = readFileSync(new URL("./OperationCommercialAdmin.tsx", import.meta.url), "utf8");
const instantOrders = readFileSync(new URL("./OperationInstantOrders.tsx", import.meta.url), "utf8");
const access = readFileSync(new URL("./AccessApp.tsx", import.meta.url), "utf8");

describe("histórico separado das filas operacionais", () => {
  it("reúne os registros encerrados em uma área própria", () => {
    expect(archive).toContain("Histórico e arquivados");
    expect(archive).toContain('category: "requests"');
    expect(archive).toContain('category: "orders"');
    expect(archive).toContain('category: "groups"');
    expect(archive).toContain('category: "customers"');
    expect(archive).toContain("Responsável:");
    expect(archive).toContain("Motivo:");
    expect(access).toContain('<Archive /> Histórico');
  });

  it("não mistura cancelados e concluídos nas listas de trabalho", () => {
    expect(commercial).not.toContain('["completed", "Concluídos"]');
    expect(commercial).not.toContain('["cancelled", "Cancelados"]');
    expect(instantOrders).toContain('.filter((order) => !["completed", "cancelled", "expired"].includes(order.status))');
  });

  it("mantém dados pessoais anonimizados fora do histórico visível", () => {
    expect(archive).toContain('profile.account_status === "anonymized"');
    expect(archive).toContain("Os dados pessoais já foram removidos.");
  });
});
