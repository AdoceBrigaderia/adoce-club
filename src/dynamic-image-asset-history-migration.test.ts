import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../supabase/migrations/20260726065557_dynamic_image_asset_versions.sql", import.meta.url),
  "utf8",
);

describe("histórico das capas dinâmicas", () => {
  it("cria tabela protegida e índices por ativo e proprietário", () => {
    expect(migration).toContain("create table if not exists public.dynamic_image_asset_versions");
    expect(migration).toContain("dynamic_image_asset_versions_asset_changed_idx");
    expect(migration).toContain("dynamic_image_asset_versions_owner_idx");
    expect(migration).toContain("alter table public.dynamic_image_asset_versions enable row level security");
  });

  it("restringe a leitura aos gestores", () => {
    expect(migration).toContain("dynamic_image_asset_versions_manager_read");
    expect(migration).toContain("using ((select private.is_manager()))");
    expect(migration).not.toContain("grant select on public.dynamic_image_asset_versions to anon");
  });

  it("audita capas de sabores e tortas inteiras", () => {
    expect(migration).toContain("private.capture_flavor_image_versions()");
    expect(migration).toContain("capture_flavor_image_versions");
    expect(migration).toContain("'flavor-cover'");
    expect(migration).toContain("'whole-cake'");
    expect(migration).toContain("whole_cake_original_image_path");
  });

  it("audita produtos e categorias comerciais", () => {
    expect(migration).toContain("private.capture_commercial_product_image_versions()");
    expect(migration).toContain("private.capture_commercial_segment_image_versions()");
    expect(migration).toContain("'commercial-product'");
    expect(migration).toContain("'commercial-segment'");
  });

  it("registra criação, atualização e exclusão com autor", () => {
    expect(migration).toContain("change_type in ('created', 'updated', 'deleted')");
    expect(migration).toContain("changed_by_name");
    expect(migration).toContain("private.dynamic_image_actor_name(actor_id)");
    expect(migration).toContain("coalesce(actor_id, snapshot.updated_by)");
  });

  it("faz backfill idempotente dos registros existentes", () => {
    expect(migration.match(/not exists \(/g)?.length).toBeGreaterThanOrEqual(4);
    expect(migration).toContain("'flavor:' || f.id::text || ':cover'");
    expect(migration).toContain("'flavor:' || f.id::text || ':whole-cake'");
    expect(migration).toContain("'product:' || p.id::text || ':cover'");
    expect(migration).toContain("'segment:' || s.segment || ':cover'");
  });
});
