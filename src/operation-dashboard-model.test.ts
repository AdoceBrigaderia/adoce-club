import { describe, expect, it } from "vitest";
import {
  buildDashboardData,
  dashboardAttentionCount,
  dashboardPriorities,
  operationTodayKey,
} from "./operation-dashboard-model";

describe("central da operação", () => {
  it("consolida vendas, retiradas, clientes, estoque e produção", () => {
    const data = buildDashboardData({
      sales: [
        { status: "awaiting_payment" },
        { status: "reserved" },
        { status: "ready" },
        { status: "preparing" },
      ],
      requests: [{ status: "new" }, { status: "quoted" }],
      members: 125,
      availability: [
        { quantity_available: 10, quantity_reserved: 8, status: "available" },
        { quantity_available: 8, quantity_reserved: 1, status: "available" },
        { quantity_available: 2, quantity_reserved: 0, status: "unavailable" },
      ],
      production: [
        { quantity_planned: 13, quantity_released: 8, status: "published" },
        { quantity_planned: 10, quantity_released: 10, status: "published" },
      ],
    });

    expect(data).toEqual({
      activeSales: 4,
      awaitingPayment: 2,
      ready: 1,
      activeRequests: 2,
      members: 125,
      lowStock: 1,
      productionPending: 1,
      productionPendingUnits: 5,
    });
  });

  it("ordena as pendências em ações objetivas", () => {
    const priorities = dashboardPriorities({
      activeSales: 7,
      awaitingPayment: 2,
      ready: 3,
      activeRequests: 1,
      members: 10,
      lowStock: 1,
      productionPending: 2,
      productionPendingUnits: 9,
    });

    expect(priorities.map((item) => item.id)).toEqual([
      "payment",
      "pickup",
      "production",
      "stock",
    ]);
    expect(priorities[2]?.description).toContain("9 unidades");
    expect(dashboardAttentionCount({
      activeSales: 7,
      awaitingPayment: 2,
      ready: 3,
      activeRequests: 1,
      members: 10,
      lowStock: 1,
      productionPending: 2,
      productionPendingUnits: 9,
    })).toBe(8);
  });

  it("remove prioridades zeradas", () => {
    expect(dashboardPriorities({
      activeSales: 0,
      awaitingPayment: 0,
      ready: 0,
      activeRequests: 0,
      members: 0,
      lowStock: 0,
      productionPending: 0,
      productionPendingUnits: 0,
    })).toEqual([]);
  });

  it("gera a data operacional no fuso de Fortaleza", () => {
    expect(operationTodayKey(new Date("2026-07-27T01:30:00.000Z"))).toBe("2026-07-26");
  });
});
