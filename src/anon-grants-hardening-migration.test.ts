import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260727071000_anon_grants_hardening.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("endurecimento dos privilégios anônimos", () => {
  it("remove DML anônimo de todas as tabelas públicas", () => {
    expect(migration).toContain(
      "revoke insert, update, delete, truncate, references, trigger on table",
    );
    expect(migration).toContain("from anon");
    expect(migration).toContain("revoke all privileges on table");
    expect(migration).toContain("from public");
  });

  it("limita SELECT anônimo a uma lista pública explícita", () => {
    expect(migration).toContain("revoke select on table");
    expect(migration).toContain("public.flavors");
    expect(migration).toContain("public.flavor_availability");
    expect(migration).toContain("public.commercial_products");
    expect(migration).toContain("public.weekly_service_menu");
    expect(migration).not.toMatch(/grant select on table[\s\S]*public\.profiles/);
    expect(migration).not.toMatch(/grant select on table[\s\S]*public\.audit_events/);
    expect(migration).not.toMatch(/grant select on table[\s\S]*public\.cash_sessions/);
  });

  it("fecha helpers e versões antigas de pedido", () => {
    expect(migration).toContain(
      "revoke all on function public.set_site_visual_asset_updated_at()",
    );
    expect(migration).toContain(
      "revoke all on function public.submit_instant_order(text,text,jsonb,text)",
    );
    expect(migration).toContain(
      "revoke all on function public.submit_instant_order_v2(text,text,jsonb,text)",
    );
    expect(migration).toContain(
      "revoke all on function public.submit_instant_order_v4(text,text,jsonb,text)",
    );
    expect(migration).not.toContain(
      "revoke all on function public.submit_instant_order_v5",
    );
  });
});
