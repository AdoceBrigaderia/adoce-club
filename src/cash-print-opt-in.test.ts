import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sale = readFileSync(new URL("./OperationManualSale.tsx", import.meta.url), "utf8");
const dialog = readFileSync(new URL("./CashCheckoutDialog.tsx", import.meta.url), "utf8");
const orders = readFileSync(new URL("./OperationInstantOrders.tsx", import.meta.url), "utf8");
const native = readFileSync(new URL("../android/app/src/main/java/br/com/adocebrigaderia/operacao/AdoceOrderService.java", import.meta.url), "utf8");

describe("impressão da venda presencial somente por escolha", () => {
  it("inicia e reinicia desmarcada, e condiciona o envio", () => {
    expect(sale).toContain("[printReceipt, setPrintReceipt] = useState(false)");
    expect(dialog).toContain('checked={printReceipt}');
    expect(sale).toContain("if (shouldPrint)");
    expect(sale).toContain("setPrintReceipt(false)");
  });
  it("impede que os ouvintes imprimam vendas do caixa sem solicitação", () => {
    expect(orders).toContain('data.sales_channel === "operation"');
    expect(native).toContain('!force && "operation".equals(order.optString("sales_channel"))');
  });
});
