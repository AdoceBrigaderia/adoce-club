import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";

const fixture = vi.hoisted(() => ({ index: 0, status: "preparing", paymentStatus: "not_started" }));
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual, useState: (initial: unknown) => {
    const index = fixture.index++;
    const order = {
      id: "00000000-0000-4000-8000-000000000001", order_number: "PRÉVIA LOCAL",
      customer_name: "Cliente de teste", customer_phone: "", status: fixture.status,
      payment_status: fixture.paymentStatus, payment_method_code: "pix", sales_channel: "site",
      total: 32, created_at: "2026-10-10T17:04:00Z", pickup_label: "Retirada deste pedido",
      pickup_address: "Rua Odíllio Filho, 227", internal_notes: "",
      instant_order_items: ["Morango com Suspiros", "Black Velvet", "Red Velvet com Ninho e Nutella"].map((name, i) => ({
        id: `test-${i}`, flavor_name: name, flavor_id: `test-${i}`, quantity: 1,
        unit_price: i === 2 ? 0 : 16, is_reward: i === 2, status: "reserved",
        instant_order_item_sauces: [],
      })),
    };
    return actual.useState(index === 0 ? [order] : index === 1 ? order : initial);
  } };
});
import OperationInstantOrders from "./OperationInstantOrders";

describe("pagamento online durante a separação", () => {
  it("mostra a ação direta, Red gratuita e endereço específico", () => {
    fixture.index = 0;
    const html = renderToStaticMarkup(<OperationInstantOrders />);
    expect(html).toContain("Ainda não pagou");
    expect(html).toContain("Confirmar separação e enviar cobrança");
    expect(html).toContain("Já pagou");
    expect(html).toContain("Confirmar pagamento e liberar retirada");
    expect(html).not.toContain("Como a cliente pagou?");
    expect(html).toContain("GRÁTIS");
    expect(html).toContain("Rua Odíllio Filho, 227");
    const css = ["styles.css", "theme.css", "adoce-app-2026.css", "adoce-mobile-first-2026.css", "adoce-tokens.css", "cash-register-layout.css", "operation-shell.css", "access-app.css", "operation-v3.css", "operation-tablet.css", "operation-instant-orders.css", "operation-instant-orders-enhancements.css", "operation-print.css"]
      .map((file) => readFileSync(`src/${file}`, "utf8")).join("\n");
    mkdirSync("artifacts", { recursive: true });
    writeFileSync("artifacts/payment-release-preview.html", `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Prévia local — pagamento e retirada</title><style>${css}</style><main class="operation-home">${html}</main></html>`);
  });
  it("não oferece confirmar pagamento novamente quando já pronto e pago", () => {
    fixture.index = 0; fixture.status = "ready"; fixture.paymentStatus = "approved";
    const html = renderToStaticMarkup(<OperationInstantOrders />);
    expect(html).not.toContain("Ainda não pagou");
    expect(html).not.toContain("Já pagou");
    expect(html).toContain("Marcar como entregue");
    fixture.status = "preparing"; fixture.paymentStatus = "not_started";
  });
  it("não oferece enviar cobrança depois do pagamento aprovado", () => {
    fixture.index = 0; fixture.paymentStatus = "approved";
    const html = renderToStaticMarkup(<OperationInstantOrders />);
    expect(html).not.toContain("Ainda não pagou");
    expect(html).not.toContain("Confirmar separação e enviar cobrança");
    expect(html).toContain("Liberar para retirada e avisar");
    fixture.paymentStatus = "not_started";
  });
});
