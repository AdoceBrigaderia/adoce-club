import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OPERATION_RPC_ALLOWLIST } from "../netlify/functions/_shared/bff-rpc-policy";

const source = readFileSync(
  new URL("./OperationManualSale.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("./operation-commerce-tools.css", import.meta.url),
  "utf8",
);

describe("venda rápida protegida pelo BFF", () => {
  it("não usa o cliente Supabase nem bearer token no navegador", () => {
    expect(source).toContain('from "./services/bff-rpc"');
    expect(source).not.toContain("requireSupabase");
    expect(source).not.toContain("@supabase/supabase-js");
    expect(source).not.toContain("Authorization");
  });

  it("carrega catálogo e conclui venda por RPCs explícitos", () => {
    expect(OPERATION_RPC_ALLOWLIST).toContain("staff_get_quick_sale_catalog");
    expect(source).toContain('"staff_get_quick_sale_catalog"');
    expect(source).toContain('"staff_get_business_workspace"');
    expect(source).toContain('"staff_create_manual_sale_in_cash"');
  });

  it("permite adicionar produto com um toque e ajustar quantidade sem modal", () => {
    expect(source).toContain("manual-sale-product-main");
    expect(source).toContain("setQuantity(flavor, quantity + 1)");
    expect(source).toContain("manual-sale-product-controls");
    expect(source).toContain("Registrar venda ·");
  });

  it("usa cartões grandes e barra final fixa no celular", () => {
    expect(styles).toContain(".manual-sale-product-main");
    expect(styles).toContain("min-height:88px");
    expect(styles).toContain(".manual-sale-sticky-total");
    expect(styles).toContain("position:sticky");
    expect(styles).toContain("min-height:58px");
  });
});
