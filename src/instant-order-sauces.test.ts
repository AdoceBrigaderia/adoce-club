import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hasFirstAndLastName } from "./InstantOrderPanel";

const panel = readFileSync(new URL("./InstantOrderPanel.tsx", import.meta.url), "utf8");
const operation = readFileSync(new URL("./OperationInstantOrders.tsx", import.meta.url), "utf8");
const manualSale = readFileSync(new URL("./OperationManualSale.tsx", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../supabase/migrations/20260722212224_add_order_sauces_and_friendly_pickup.sql", import.meta.url),
  "utf8",
);

describe("caldas individuais no pedido de fatias", () => {
  it("exige ao menos nome e sobrenome", () => {
    expect(hasFirstAndLastName("Rubens")).toBe(false);
    expect(hasFirstAndLastName("R B")).toBe(false);
    expect(hasFirstAndLastName("Rubens Bezerra")).toBe(true);
    expect(panel).toContain("Informe seu nome e sobrenome");
  });

  it("pede uma escolha por unidade e permite sem calda", () => {
    expect(panel).toContain("Escolha uma opção para cada fatia");
    expect(panel).toContain('<option value="none">Sem calda</option>');
    expect(panel).toContain("Finalizar pelo WhatsApp");
    expect(panel).toContain('rpc("submit_instant_order_v7"');
  });

  it("oferece escolha compacta da calda dentro do pedido da operação", () => {
    expect(operation).not.toContain("Caldas disponíveis");
    expect(operation).not.toContain("Nome da nova calda");
    expect(manualSale).toContain('from("order_sauces")');
    expect(manualSale).toContain("Escolha a calda");
    expect(manualSale).toContain('sauce_id: sauceChoices');
    expect(operation).toContain("Reenviar link pelo WhatsApp");
    expect(operation).toContain("Confirmar e enviar cobrança");
  });

  it("protege as tabelas e mantém somente leitura pública das caldas ativas", () => {
    expect(migration).toContain("alter table public.order_sauces enable row level security");
    expect(migration).toContain("alter table public.instant_order_item_sauces enable row level security");
    expect(migration).toContain("order_sauces_public_active_read");
    expect(migration).toContain("using (active)");
    expect(migration).toContain("private.is_staff()");
  });

  it("usa uma apresentação mais acolhedora para a retirada", () => {
    expect(migration).toContain("public_label = 'Retire na Adoce'");
    expect(panel).not.toContain("Retirada no portão");
  });
});
