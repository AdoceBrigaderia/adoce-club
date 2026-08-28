import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../supabase/migrations/20260807062957_meta_catalog_sync_20260731.sql", import.meta.url), "utf8");

describe("fundação segura do catálogo Meta", () => {
  it("preserva identificador permanente e fila local", () => {
    expect(migration).toContain("meta_retailer_id text");
    expect(migration).toContain("O identificador permanente da Meta não pode ser alterado");
    expect(migration).toContain("meta_sync_status text not null default 'disabled'");
    expect(migration).toContain("meta_payload_hash text");
  });

  it("protege o histórico com RLS e acesso apenas gerencial", () => {
    expect(migration).toContain("alter table public.meta_catalog_sync_history enable row level security");
    expect(migration).toContain("using (private.is_manager())");
    expect(migration).not.toMatch(/for select to (anon|public)/);
  });

  it("não inclui exclusão destrutiva de produto", () => {
    expect(migration).not.toContain("drop table public.commercial_products");
    expect(migration).not.toContain("delete from public.commercial_products");
  });
});
