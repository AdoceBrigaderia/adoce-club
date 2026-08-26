import { describe, expect, it } from "vitest";
import {
  filterBusinessHours,
  type BusinessHour,
} from "./OperationContentAdmin";

describe("filtro da agenda recorrente", () => {
  it("mostra todos os dias do canal escolhido em ordem", () => {
    const hours: BusinessHour[] = [
      {
        id: "online-tuesday",
        channel_slug: "online_orders",
        weekday: 2,
        opens_at: "09:00:00",
        closes_at: "22:00:00",
        active: true,
        note: null,
      },
      {
        id: "online-wednesday",
        channel_slug: "online_orders",
        weekday: 3,
        opens_at: "09:00:00",
        closes_at: "22:00:00",
        active: true,
        note: null,
      },
      {
        id: "preorder-tuesday",
        channel_slug: "preorders",
        weekday: 2,
        opens_at: "09:00:00",
        closes_at: "18:00:00",
        active: true,
        note: null,
      },
    ];

    expect(filterBusinessHours(hours, "online_orders")).toEqual([
      hours[0],
      hours[1],
    ]);
  });

  it("oferece edição e exclusão de cada horário", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./OperationContentAdmin.tsx", import.meta.url), "utf8"),
    );

    expect(source).toContain("Editar horário de");
    expect(source).toContain("Atualizar horário");
    expect(source).toContain("removeHour(hour.id)");
  });

  it("mantém a identificação explícita do canal que controla a retirada", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./OperationContentAdmin.tsx", import.meta.url), "utf8"),
    );

    expect(source).toContain("Pedidos online — retirada na Adoce");
    expect(source).toContain("Encomendas futuras — não controla a retirada");
    expect(source).toContain('channel.slug !== "store"');
  });
});
