import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260727030917_public_order_bff_only.sql",
    import.meta.url,
  ),
  "utf8",
);
const endpoint = readFileSync(
  new URL("../netlify/functions/public-instant-order.ts", import.meta.url),
  "utf8",
);

describe("pedido público restrito ao BFF", () => {
  it("remove execução anônima das funções atuais", () => {
    expect(migration).toContain(
      "revoke all on function public.get_checkout_payment_methods() from public, anon",
    );
    expect(migration).toContain(
      "revoke all on function public.public_quote_instant_order(jsonb,jsonb) from public, anon",
    );
    expect(migration).toContain(
      "revoke all on function public.submit_instant_order_v5(text,text,jsonb,text,text,jsonb) from public, anon",
    );
  });

  it("preserva execução para cliente autenticado e backend", () => {
    expect(migration).toContain("to authenticated, service_role");
    expect(migration).not.toContain("to anon");
  });

  it("faz chamadas anônimas com segredo somente no servidor", () => {
    expect(endpoint).toContain(
      'env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY")',
    );
    expect(endpoint).toContain(
      "const apiKey = accessToken ? publishableKey : secretKey",
    );
    expect(endpoint).toContain("const bearer = accessToken || secretKey");
    expect(endpoint).toContain("await options(supabaseUrl, secretKey)");
  });
});
