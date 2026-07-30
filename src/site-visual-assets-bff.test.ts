import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260728154500_site_visual_assets_bff.sql",
  "utf8",
);
const endpoint = readFileSync(
  "netlify/functions/auth-bff-site-visual-upload.ts",
  "utf8",
);
const policy = readFileSync(
  "netlify/functions/_shared/bff-rpc-policy.ts",
  "utf8",
);
const client = readFileSync("src/services/bff-site-visual.ts", "utf8");
const settings = readFileSync("src/OperationSiteVisualSettingsBff.tsx", "utf8");
const history = readFileSync(
  "src/OperationSiteVisualAssetHistoryBff.tsx",
  "utf8",
);
const center = readFileSync("src/OperationAdminCenter.tsx", "utf8");

describe("central de imagens institucionais pelo BFF", () => {
  it("remove escrita e histórico direto do navegador", () => {
    expect(migration).toContain(
      "revoke insert, update, delete on public.site_visual_assets from authenticated",
    );
    expect(migration).toContain(
      "revoke select on public.site_visual_asset_versions from authenticated",
    );
    expect(migration).toContain("private.is_manager()");
    expect(migration).toContain("manager_assert_site_visual_access");
    expect(migration).toContain("manager_get_site_visual_assets_workspace");
    expect(migration).toContain("manager_list_site_visual_asset_versions");
    expect(migration).toContain("manager_save_site_visual_asset");
    expect(migration).toContain("manager_reset_site_visual_asset");
    expect(migration).toContain("manager_restore_site_visual_asset_version");
  });

  it("mantém somente operações seguras na allowlist genérica", () => {
    [
      "manager_get_site_visual_assets_workspace",
      "manager_list_site_visual_asset_versions",
      "manager_reset_site_visual_asset",
      "manager_restore_site_visual_asset_version",
    ].forEach((rpc) => expect(policy).toContain(`\"${rpc}\"`));
    expect(policy).not.toContain('"manager_save_site_visual_asset"');
  });

  it("envia arquivo pelo BFF com sessão HttpOnly, CSRF e validação", () => {
    expect(endpoint).toContain("guardBffRequest(request");
    expect(endpoint).toContain('methods: ["POST"]');
    expect(endpoint).toContain('configuredSiteUrl: env("SITE_URL")');
    expect(endpoint).toContain("requireCsrf: true");
    expect(endpoint).not.toContain("allowedOrigin(request");
    expect(endpoint).not.toContain("validCsrf(request)");
    expect(endpoint).toContain('cookies.get(SURFACE_COOKIE) !== "operation"');
    expect(endpoint).toContain("cookies.get(ACCESS_COOKIE)");
    expect(endpoint).toContain("manager_assert_site_visual_access");
    expect(endpoint).toContain("MAX_ORIGINAL_BYTES = 6 * 1024 * 1024");
    expect(endpoint).toContain("MAX_EDITED_BYTES = 750 * 1024");
    expect(endpoint).toContain('edited.type !== "image/webp"');
    expect(endpoint).toContain("ALLOWED_RATIOS");
    expect(endpoint).toContain("storage/v1/object/adoce-media");
    expect(endpoint).toContain("manager_save_site_visual_asset");
    expect(endpoint).toContain("deleteObject");
    expect(endpoint).not.toContain("SUPABASE_SECRET_KEY");
    expect(endpoint).not.toContain("service_role");
  });

  it("não expõe token nem cliente Supabase nos componentes", () => {
    expect(client).toContain('credentials: "same-origin"');
    expect(client).toContain('"X-CSRF-Token": csrfToken');
    expect(client).toContain("getBffSession");
    expect(settings).toContain("getSiteVisualWorkspace");
    expect(settings).toContain("uploadSiteVisualAsset");
    expect(settings).toContain("resetSiteVisualAsset");
    expect(history).toContain("listSiteVisualVersions");
    expect(history).toContain("restoreSiteVisualAssetVersion");
    [client, settings, history].forEach((source) => {
      expect(source).not.toContain("requireSupabase");
      expect(source).not.toContain("localStorage");
      expect(source).not.toContain("sessionStorage");
      expect(source).not.toContain("Authorization:");
    });
  });

  it("expõe fotos e identidade na central de proprietário e gerente", () => {
    expect(center).toContain('id: "images"');
    expect(center).toContain("Fotos e identidade");
    expect(center).toContain("<OperationSiteVisualSettingsBff />");
  });
});
