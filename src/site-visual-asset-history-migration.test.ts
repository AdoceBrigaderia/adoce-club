import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../supabase/migrations/20260726005258_site_visual_asset_versions.sql", import.meta.url),
  "utf8",
);

describe("histórico auditável da Central de Imagens", () => {
  it("cria tabela protegida e índice por imagem/data", () => {
    expect(migration).toContain("create table if not exists public.site_visual_asset_versions");
    expect(migration).toContain("site_visual_asset_versions_asset_changed_idx");
    expect(migration).toContain("alter table public.site_visual_asset_versions enable row level security");
  });

  it("restringe a leitura aos gestores", () => {
    expect(migration).toContain("site_visual_asset_versions_manager_read");
    expect(migration).toContain("using ((select private.is_manager()))");
    expect(migration).not.toContain("grant select on public.site_visual_asset_versions to anon");
  });

  it("registra criação, atualização e exclusão com usuário e nome", () => {
    expect(migration).toContain("private.capture_site_visual_asset_version()");
    expect(migration).toContain("after insert or update or delete on public.site_visual_assets");
    expect(migration).toContain("changed_by_name");
    expect(migration).toContain("coalesce(actor_id, snapshot.updated_by)");
  });

  it("faz backfill apenas quando a imagem ainda não possui versão", () => {
    expect(migration).toContain("where not exists");
    expect(migration).toContain("where version.asset_key = asset.asset_key");
  });
});
