import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const analyticsSource = readFileSync(new URL("./analytics.ts", import.meta.url), "utf8");
const analyticsMigration = readFileSync(
  new URL("../supabase/migrations/20260722024148_add_privacy_safe_site_analytics.sql", import.meta.url),
  "utf8",
);
const auditMigration = readFileSync(
  new URL("../supabase/migrations/20260722023733_improve_service_request_audit.sql", import.meta.url),
  "utf8",
);

describe("analytics anônimo e histórico operacional", () => {
  it("não cria cookie nem envia campos pessoais", () => {
    expect(analyticsSource).not.toContain("document.cookie");
    expect(analyticsMigration).not.toMatch(/customer_name|phone|email|ip_hash/i);
    expect(analyticsMigration).toContain("revoke all on public.site_analytics_events from public, anon, authenticated");
  });

  it("aceita somente eventos e propriedades conhecidas", () => {
    expect(analyticsMigration).toContain("requested_event_name not in");
    expect(analyticsMigration).toContain("octet_length(safe_properties::text) > 1200");
    expect(analyticsMigration).toContain("'product_slug', safe_properties -> 'product_slug'");
  });

  it("preserva a transição anterior e a nova no histórico de pedidos", () => {
    expect(auditMigration).toContain("'from_status', current_request.status");
    expect(auditMigration).toContain("'status', next_status");
    expect(auditMigration).toContain("security invoker");
  });
});
