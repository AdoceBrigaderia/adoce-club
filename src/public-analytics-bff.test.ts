import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const frontend = readFileSync(new URL("./analytics.ts", import.meta.url), "utf8");
const endpoint = readFileSync(
  new URL("../netlify/functions/public-analytics-event.ts", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260727035513_public_analytics_bff_only.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("analytics pública protegida pelo BFF", () => {
  it("não importa nem chama o Supabase no navegador", () => {
    expect(frontend).not.toContain("./lib/supabase");
    expect(frontend).not.toContain('.rpc("record_site_analytics_event"');
    expect(frontend).toContain('/api/public-analytics-event');
    expect(frontend).toContain("keepalive: true");
  });

  it("valida origem, evento, caminho e propriedades no servidor", () => {
    expect(endpoint).toContain("allowedOrigin");
    expect(endpoint).toContain("ALLOWED_EVENTS");
    expect(endpoint).toContain("ALLOWED_PROPERTIES");
    expect(endpoint).toContain('pagePath.startsWith("/")');
    expect(endpoint).toContain("SUPABASE_SECRET_KEY");
  });

  it("remove execução direta e mantém apenas service_role", () => {
    expect(migration).toContain(
      "revoke execute on function public.record_site_analytics_event(uuid,text,text,jsonb)",
    );
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
  });
});
