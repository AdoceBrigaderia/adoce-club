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

  it("mantém encerrados fora da fila ativa, mas permite consultá-los por filtro", () => {
    expect(commercial).toContain('useState<RequestFilter>("active")');
    expect(commercial).toContain('if (filter === "active") return !["completed", "cancelled", "expired"].includes(status)');
    expect(commercial).toContain('["completed", "Concluídos"]');
    expect(commercial).toContain('["cancelled", "Cancelados ou expirados"]');
    expect(instantOrders).toContain('.filter((order) => !["completed", "cancelled", "expired"].includes(order.status))');
  });

  it("mantém dados pessoais anonimizados fora do histórico visível", () => {
    expect(archive).toContain('profile.account_status === "anonymized"');
    expect(archive).toContain("Os dados pessoais já foram removidos.");
  });
});
