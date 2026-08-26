import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("formas de pagamento do pedido público", () => {
  const panel = readFileSync("src/InstantOrderPanel.tsx", "utf8");
  const migration = readFileSync(
    "supabase/migrations/20260815135747_restore_public_checkout_payment_methods.sql",
    "utf8",
  );

  it("restaura somente a consulta pública dos meios de pagamento", () => {
    expect(migration).toContain(
      "revoke all on function public.get_checkout_payment_methods() from public",
    );
    expect(migration).toContain(
      "grant execute on function public.get_checkout_payment_methods() to anon, authenticated",
    );
  });

  it("não deixa a falha da consulta bloquear o cliente silenciosamente", () => {
    expect(panel).toContain("if (paymentResult.error)");
    expect(panel).toContain("Não foi possível carregar as formas de pagamento.");
    expect(panel).toContain("Tentar novamente");
    expect(panel).toContain("disabled={paymentMethodsLoading || Boolean(paymentMethodsError)}");
    expect(panel).toContain("if (paymentMethodsError) return setNotice");
    expect(panel).toContain("disabled={!totalQuantity || paymentMethodsLoading || Boolean(paymentMethodsError) || !paymentMethod}");
  });
});
