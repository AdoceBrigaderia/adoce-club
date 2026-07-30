import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const panel = readFileSync(
  new URL("./InstantOrderPanel.tsx", import.meta.url),
  "utf8",
);
const client = readFileSync(
  new URL("./services/public-instant-order.ts", import.meta.url),
  "utf8",
);
const endpoint = readFileSync(
  new URL("../netlify/functions/public-instant-order.ts", import.meta.url),
  "utf8",
);

describe("pedido imediato pelo BFF", () => {
  it("remove Supabase e tokens da tela pública", () => {
    expect(panel).not.toContain("requireSupabase");
    expect(panel).not.toContain("auth.getSession");
    expect(panel).not.toContain('.rpc("submit_instant_order_v5"');
    expect(panel).not.toContain("Authorization");
    expect(panel).toContain("submitPublicInstantOrder");
    expect(panel).toContain("quotePublicInstantOrder");
  });

  it("usa cotação oficial do servidor e não fixa R$ 16 no navegador", () => {
    expect(panel).toContain("quote?.total");
    expect(panel).toContain("quote?.reward_upgrade");
    expect(panel).toContain("server_calculated: true");
    expect(panel).not.toContain("flavor.price - 16");
  });

  it("encaminha tudo para um endpoint same-origin com sessão renovável", () => {
    expect(client).toContain('fetch("/api/public-instant-order"');
    expect(client).toContain('credentials: "same-origin"');
    expect(client).toContain('"X-CSRF-Token"');
    expect(client).toContain("getBffSession()");
    expect(client).toContain('failure.code !== "session_refresh_required"');
  });

  it("usa segredo somente no BFF para impedir bypass anônimo do RPC", () => {
    expect(endpoint).toContain("allowedOrigin");
    expect(endpoint).toContain("normalizeItems");
    expect(endpoint).toContain("normalizeReward");
    expect(endpoint).toContain("PAYMENT_CODE");
    expect(endpoint).toContain('env("SUPABASE_SECRET_KEY")');
    expect(endpoint).toContain('env("SUPABASE_SERVICE_ROLE_KEY")');
    expect(endpoint).toContain("const apiKey = accessToken ? publishableKey : secretKey");
    expect(endpoint).toContain("const bearer = accessToken || secretKey");
    expect(client).not.toContain("SUPABASE_SECRET_KEY");
    expect(panel).not.toContain("SUPABASE_SECRET_KEY");
  });

  it("protege envios autenticados contra CSRF e não retorna tokens", () => {
    expect(endpoint).toContain("clientSession && !validCsrf(request)");
    expect(endpoint).toContain('secureJson({ data }, 200)');
    expect(endpoint).not.toContain("access_token");
    expect(endpoint).not.toContain("refresh_token");
  });
});
