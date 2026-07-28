import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const service = readFileSync("src/services/bff-dynamic-images.ts", "utf8");
const library = readFileSync("src/OperationDynamicImageLibraryBff.tsx", "utf8");
const history = readFileSync("src/OperationDynamicImageAssetHistoryBff.tsx", "utf8");
const central = readFileSync("src/OperationSiteVisualSettingsBff.tsx", "utf8");
const upload = readFileSync("netlify/functions/auth-bff-dynamic-image-upload.ts", "utf8");
const policy = readFileSync("netlify/functions/_shared/bff-rpc-policy.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260728164000_dynamic_image_assets_bff.sql",
  "utf8",
);

describe("capas dinâmicas protegidas pelo BFF", () => {
  it("carrega, grava e restaura somente por operações BFF", () => {
    expect(service).toContain('"manager_get_dynamic_image_workspace"');
    expect(service).toContain('"manager_list_dynamic_image_versions"');
    expect(service).toContain('"manager_restore_dynamic_image_version"');
    expect(service).toContain('/api/auth-bff-dynamic-image-upload');
    expect(service).toContain('credentials: "same-origin"');
    expect(service).toContain('"X-CSRF-Token"');
    expect(library).toContain("getDynamicImageWorkspace");
    expect(library).toContain("uploadDynamicImageAsset");
    expect(history).toContain("listDynamicImageVersions");
    expect(history).toContain("restoreDynamicImageVersion");
    expect(library).not.toContain("requireSupabase");
    expect(library).not.toContain("uploadEditedProductImage");
    expect(history).not.toContain("requireSupabase");
  });

  it("integra sabores, tortas, produtos e categorias à central administrativa", () => {
    expect(central).toContain("OperationDynamicImageLibraryBff");
    expect(central).toContain("Fotos e identidade do Portal");
    expect(library).toContain("Produtos, sabores, tortas e categorias");
    expect(library).toContain("Aguardando foto oficial");
    expect(library).toContain("operation-image-library-toolbar");
  });

  it("valida sessão, origem, CSRF, arquivos e armazenamento no servidor", () => {
    expect(upload).toContain("allowedOrigin");
    expect(upload).toContain("validCsrf");
    expect(upload).toContain('cookies.get(SURFACE_COOKIE) !== "operation"');
    expect(upload).toContain("manager_assert_dynamic_image_access");
    expect(upload).toContain("MAX_ORIGINAL_BYTES");
    expect(upload).toContain("MAX_EDITED_BYTES");
    expect(upload).toContain('edited.type !== "image/webp"');
    expect(upload).toContain("expectedRatio(kind)");
    expect(upload).toContain("manager_save_dynamic_image_asset");
    expect(upload).toContain("deleteObject");
    expect(upload).not.toContain("SUPABASE_SECRET_KEY");
    expect(upload).not.toContain("service_role");
  });

  it("mantém cálculos e autorização no banco", () => {
    expect(migration).toContain("manager_assert_dynamic_image_access");
    expect(migration).toContain("manager_get_dynamic_image_workspace");
    expect(migration).toContain("manager_save_dynamic_image_asset");
    expect(migration).toContain("manager_list_dynamic_image_versions");
    expect(migration).toContain("manager_restore_dynamic_image_version");
    expect(migration).toContain("private.is_manager()");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("grant execute");
    expect(migration).toContain("dynamic_image_asset_versions");
  });

  it("expõe apenas RPCs explicitamente autorizadas", () => {
    [
      "manager_get_dynamic_image_workspace",
      "manager_save_dynamic_image_asset",
      "manager_list_dynamic_image_versions",
      "manager_restore_dynamic_image_version",
    ].forEach((rpc) => expect(policy).toContain(`"${rpc}"`));
  });
});
