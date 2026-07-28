import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260728174500_gallery_media_assets_bff.sql",
  "utf8",
);
const endpoint = readFileSync(
  "netlify/functions/auth-bff-gallery-media-upload.ts",
  "utf8",
);
const policy = readFileSync(
  "netlify/functions/_shared/bff-rpc-policy.ts",
  "utf8",
);
const client = readFileSync("src/services/bff-gallery-media.ts", "utf8");
const library = readFileSync("src/OperationGalleryImageLibraryBff.tsx", "utf8");
const history = readFileSync("src/OperationGalleryMediaHistoryBff.tsx", "utf8");
const settings = readFileSync("src/OperationSiteVisualSettingsBff.tsx", "utf8");

const browserSources = [client, library, history];

describe("galerias e carrosséis protegidos pelo BFF", () => {
  it("remove escrita e histórico direto do navegador", () => {
    expect(migration).toContain(
      "revoke insert, update, delete on public.flavor_images from authenticated",
    );
    expect(migration).toContain(
      "revoke insert, update, delete on public.commercial_media_items from authenticated",
    );
    expect(migration).toContain(
      "revoke select on public.gallery_media_versions from authenticated",
    );
    expect(migration).toContain("manager_assert_gallery_media_access");
    expect(migration).toContain("manager_get_gallery_media_workspace");
    expect(migration).toContain("manager_save_gallery_media_asset");
    expect(migration).toContain("manager_disable_gallery_media");
    expect(migration).toContain("manager_list_gallery_media_versions");
    expect(migration).toContain("manager_restore_gallery_media_version");
    expect(migration).toContain("limite de 8 mídias");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
  });

  it("mantém apenas operações sem arquivo na allowlist genérica", () => {
    [
      "manager_get_gallery_media_workspace",
      "manager_disable_gallery_media",
      "manager_list_gallery_media_versions",
      "manager_restore_gallery_media_version",
    ].forEach((rpc) => expect(policy).toContain(`\"${rpc}\"`));
    expect(policy).not.toContain('"manager_save_gallery_media_asset"');
  });

  it("valida upload, sessão, CSRF, proporção e limpeza de falhas", () => {
    expect(endpoint).toContain('allowedOrigin(request, env("SITE_URL"))');
    expect(endpoint).toContain("validCsrf(request)");
    expect(endpoint).toContain('cookies.get(SURFACE_COOKIE) !== "operation"');
    expect(endpoint).toContain("cookies.get(ACCESS_COOKIE)");
    expect(endpoint).toContain("manager_assert_gallery_media_access");
    expect(endpoint).toContain("MAX_ORIGINAL_BYTES = 6 * 1024 * 1024");
    expect(endpoint).toContain("MAX_EDITED_BYTES = 900 * 1024");
    expect(endpoint).toContain('edited.type !== "image/webp"');
    expect(endpoint).toContain("expectedRatio(ownerKind)");
    expect(endpoint).toContain("manager_save_gallery_media_asset");
    expect(endpoint).toContain("deleteObject");
    expect(endpoint).not.toContain("SUPABASE_SECRET_KEY");
    expect(endpoint).not.toContain("service_role");
  });

  it("usa BFF na central, no histórico e nas remoções", () => {
    expect(settings).toContain("OperationGalleryImageLibraryBff");
    expect(library).toContain("getGalleryMediaWorkspace");
    expect(library).toContain("uploadGalleryMedia");
    expect(library).toContain("disableGalleryMedia");
    expect(library).toContain("OperationGalleryMediaHistoryBff");
    expect(history).toContain("listGalleryMediaVersions");
    expect(history).toContain("restoreGalleryMediaVersion");
    expect(client).toContain('credentials: "same-origin"');
    expect(client).toContain('"X-CSRF-Token": csrfToken');
    expect(client).toContain("getBffSession");
  });

  it("não expõe cliente Supabase ou tokens nos componentes novos", () => {
    browserSources.forEach((source) => {
      expect(source).not.toContain("requireSupabase");
      expect(source).not.toContain("localStorage");
      expect(source).not.toContain("sessionStorage");
      expect(source).not.toContain("Authorization:");
      expect(source).not.toContain("service_role");
    });
  });
});
