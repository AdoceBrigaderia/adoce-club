import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const operation = readFileSync(new URL("./OperationPedeJunto.tsx", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../supabase/migrations/20260722214817_harden_pede_junto_status_inventory_and_cancel.sql", import.meta.url),
  "utf8",
);

describe("integridade operacional do Pede Junto", () => {
  it("impede incluir sabor que não esteja liberado na data atual", () => {
    expect(migration).toContain("Este sabor não está liberado para pedidos hoje");
    expect(migration).toContain("availability.status in ('available', 'last_units', 'preorder_only')");
  });

  it("impede concluir grupo com pagamentos ou fatias pendentes", () => {
    expect(migration).toContain("Ainda há participante com pagamento pendente");
    expect(migration).toContain("O grupo ainda possui fatias sem pagamento confirmado");
  });

  it("cancela com motivo, libera reservas e preserva auditoria", () => {
    expect(migration).toContain("Informe o motivo do cancelamento");
    expect(migration).toContain("quantity_reserved = greatest(0, availability.quantity_reserved - requested.quantity)");
    expect(migration).toContain("pede_junto.status_changed");
    expect(operation).toContain("Cancelar e preservar no histórico");
  });

  it("mostra data e hora e oferece impressão ou PDF", () => {
    expect(operation).toContain("Pedido criado em");
    expect(operation).toContain("Imprimir ou salvar em PDF");
    expect(operation).toContain("window.print()");
  });
});
