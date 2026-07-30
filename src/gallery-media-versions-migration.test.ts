import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../supabase/migrations/20260726085953_gallery_media_versions.sql", import.meta.url),
  "utf8",
);

describe("histórico das imagens de galerias e carrosséis", () => {
  it("cria tabela protegida e índices de consulta", () => {
    expect(migration).toContain("create table if not exists public.gallery_media_versions");
    expect(migration).toContain("gallery_media_versions_media_changed_idx");
    expect(migration).toContain("gallery_media_versions_owner_changed_idx");
    expect(migration).toContain("alter table public.gallery_media_versions enable row level security");
  });

  it("restringe a leitura aos gestores", () => {
    expect(migration).toContain("gallery_media_versions_manager_read");
    expect(migration).toContain("using ((select private.is_manager()))");
    expect(migration).not.toContain("grant select on public.gallery_media_versions to anon");
  });

  it("audita fotos de sabores", () => {
    expect(migration).toContain("private.capture_flavor_gallery_media_version()");
    expect(migration).toContain("capture_flavor_gallery_media_version");
    expect(migration).toContain("'flavor-media:' || snapshot.id::text");
    expect(migration).toContain("after insert or update of image_path, original_image_path, alt_text, caption, image_role, sort_order, active or delete");
  });

  it("audita fotos e Reels comerciais", () => {
    expect(migration).toContain("private.capture_commercial_gallery_media_version()");
    expect(migration).toContain("'commercial-image'");
    expect(migration).toContain("'commercial-instagram'");
    expect(migration).toContain("'commercial-media:' || snapshot.id::text");
  });

  it("preserva conteúdo, ordem, visibilidade e autoria", () => {
    for (const field of [
      "image_url",
      "original_image_url",
      "external_url",
      "alt_text",
      "caption",
      "sort_order",
      "active",
      "changed_by_name",
    ]) {
      expect(migration).toContain(field);
    }
    expect(migration).toContain("private.dynamic_image_actor_name(resolved_changed_by)");
  });

  it("faz backfill idempotente de mídias existentes", () => {
    expect(migration.match(/where not exists/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migration).toContain("from public.flavor_images image");
    expect(migration).toContain("from public.commercial_media_items media");
    expect(migration).toContain("version.media_key = 'flavor-media:' || image.id::text");
    expect(migration).toContain("version.media_key = 'commercial-media:' || media.id::text");
  });
});
