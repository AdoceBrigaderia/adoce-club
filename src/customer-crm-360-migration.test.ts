import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260727003000_customer_crm_360.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("CRM Cliente 360 no banco", () => {
  it("protege todas as operações pela capacidade de clientes", () => {
    expect(migration.match(/staff_has_any_capability\('manage_customers'\)/g)?.length).toBeGreaterThanOrEqual(3);
    expect(migration).toContain("revoke all on function public.staff_get_customer_360(uuid) from public, anon");
    expect(migration).toContain("revoke all on table public.customer_crm_notes from public, anon, authenticated");
    expect(migration).toContain("revoke all on table public.customer_crm_tags from public, anon, authenticated");
  });

  it("consolida perfil, fidelidade, pedidos, check-ins e consentimentos", () => {
    expect(migration).toContain("'recent_orders'");
    expect(migration).toContain("'recent_movements'");
    expect(migration).toContain("'recent_checkins'");
    expect(migration).toContain("'consents'");
    expect(migration).toContain("'preferences'");
    expect(migration).toContain("'total_spent'");
  });

  it("mantém notas e etiquetas internas auditadas", () => {
    expect(migration).toContain("create table if not exists public.customer_crm_notes");
    expect(migration).toContain("create table if not exists public.customer_crm_tags");
    expect(migration).toContain("crm.customer_note_created");
    expect(migration).toContain("crm.customer_tag_added");
    expect(migration).toContain("crm.customer_tag_removed");
    expect(migration).toContain("insert into public.audit_events");
  });

  it("ativa RLS e usa search_path protegido", () => {
    expect(migration).toContain("alter table public.customer_crm_notes enable row level security");
    expect(migration).toContain("alter table public.customer_crm_tags enable row level security");
    expect(migration.match(/security definer/g)?.length).toBeGreaterThanOrEqual(3);
    expect(migration.match(/set search_path = ''/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
