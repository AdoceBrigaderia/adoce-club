import { describe, expect, it } from "vitest";
import type { DynamicImageAsset } from "./image-library-dynamic";
import {
  dynamicImageAssetChangeLabel,
  dynamicImageAssetKey,
  dynamicImageAssetRestorePlan,
  dynamicImageAssetVersionIsCurrent,
  type DynamicImageAssetVersion,
} from "./dynamic-image-asset-history";

const asset = (kind: DynamicImageAsset["kind"], ownerId = "abc"): DynamicImageAsset => ({
  id: `${kind}:${ownerId}`,
  kind,
  ownerId,
  label: "Chocolate",
  section: "Catálogo",
  description: "Imagem de teste",
  alt: "Chocolate da Adoce",
  currentUrl: "/site/current.webp",
  originalUrl: null,
  aspectWidth: 4,
  aspectHeight: 3,
  outputWidth: 1400,
  acceptedFormats: "JPG, PNG ou WebP",
  usage: "Catálogo",
  storageFolder: `produtos/${ownerId}`,
});

const version = (
  kind: DynamicImageAssetVersion["asset_kind"],
  ownerId = "abc",
): DynamicImageAssetVersion => ({
  id: "version-1",
  asset_key: dynamicImageAssetKey(asset(kind, ownerId)),
  asset_kind: kind,
  owner_id: ownerId,
  label: "Imagem anterior",
  image_url: "/site/previous.webp",
  original_image_url: "/site/original.webp",
  change_type: "updated",
  changed_by: null,
  changed_by_name: null,
  changed_at: "2026-07-26T10:00:00Z",
});

describe("histórico das capas dinâmicas", () => {
  it("gera as mesmas chaves usadas pelos triggers do banco", () => {
    expect(dynamicImageAssetKey(asset("flavor-cover"))).toBe("flavor:abc:cover");
    expect(dynamicImageAssetKey(asset("whole-cake"))).toBe("flavor:abc:whole-cake");
    expect(dynamicImageAssetKey(asset("commercial-product"))).toBe("product:abc:cover");
    expect(dynamicImageAssetKey(asset("commercial-segment"))).toBe("segment:abc:cover");
  });

  it("identifica a versão atual e apresenta a ação registrada", () => {
    expect(dynamicImageAssetVersionIsCurrent(version("flavor-cover"), "/site/previous.webp")).toBe(true);
    expect(dynamicImageAssetChangeLabel("deleted")).toBe("Imagem removida");
  });

  it("restaura a capa do sabor no campo correto", () => {
    expect(dynamicImageAssetRestorePlan(asset("flavor-cover"), version("flavor-cover"), "user-1"))
      .toEqual({
        mode: "update",
        table: "flavors",
        matchColumn: "id",
        matchValue: "abc",
        values: { image_path: "/site/previous.webp" },
      });
  });

  it("restaura torta inteira mantendo o original e a disponibilidade", () => {
    expect(dynamicImageAssetRestorePlan(asset("whole-cake"), version("whole-cake"), "user-1"))
      .toMatchObject({
        table: "flavors",
        values: {
          whole_cake_image_path: "/site/previous.webp",
          whole_cake_original_image_path: "/site/original.webp",
          whole_cake_available: true,
        },
      });
  });

  it("atribui o gestor ao restaurar produto ou categoria", () => {
    expect(dynamicImageAssetRestorePlan(asset("commercial-product"), version("commercial-product"), "user-1"))
      .toMatchObject({ values: { updated_by: "user-1" } });
    expect(dynamicImageAssetRestorePlan(asset("commercial-segment"), version("commercial-segment"), "user-1"))
      .toMatchObject({
        mode: "upsert",
        table: "commercial_segment_media",
        onConflict: "segment",
        values: { segment: "abc", updated_by: "user-1", alt_text: "Chocolate da Adoce" },
      });
  });

  it("bloqueia uma versão pertencente a outro item", () => {
    expect(() => dynamicImageAssetRestorePlan(asset("whole-cake"), version("flavor-cover"), "user-1"))
      .toThrow("A versão selecionada não pertence a esta imagem.");
  });
});
