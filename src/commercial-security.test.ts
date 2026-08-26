import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260719185917_commercial_catalog_agenda_crm.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("segurança do catálogo, agenda e CRM", () => {
  it("ativa RLS em todas as tabelas com dados operacionais", () => {
    for (const table of [
      "commercial_products",
      "service_requests",
      "calendar_blocks",
      "crm_notes",
      "crm_tasks",
    ]) {
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it("não concede leitura anônima de solicitações ou CRM", () => {
    expect(migration).not.toContain("grant select on public.service_requests to anon");
    expect(migration).not.toContain("grant select on public.crm_notes to anon");
    expect(migration).not.toContain("grant select on public.crm_tasks to anon");
  });

  it("revoga a função pública antes de liberar somente os papéis necessários", () => {
    expect(migration).toContain("revoke all on function public.submit_service_request");
    expect(migration).toContain("to anon, authenticated");
    expect(migration).toContain("pg_advisory_xact_lock");
  });
});
