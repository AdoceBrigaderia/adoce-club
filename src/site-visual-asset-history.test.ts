import { describe, expect, it } from "vitest";
import {
  siteVisualAssetChangeLabel,
  siteVisualAssetRestorePayload,
  siteVisualAssetVersionDate,
  siteVisualAssetVersionIsCurrent,
  type SiteVisualAssetVersion,
} from "./site-visual-asset-history";

const version: SiteVisualAssetVersion = {
  id: "version-1",
  asset_key: "/site/logo.webp",
  label: "Logo oficial",
  section: "Marca",
  default_url: "/site/logo.webp",
  image_url: "https://cdn.exemplo.com/logo-anterior.webp",
  original_image_url: "https://cdn.exemplo.com/logo-original.png",
  alt_text: "Adoce Brigaderia",
  active: true,
  change_type: "updated",
  changed_by: "user-1",
  changed_by_name: "Rubens",
  changed_at: "2026-07-26T01:00:00.000Z",
};

describe("histórico e restauração de imagens institucionais", () => {
  it("traduz os tipos de alteração para a operação", () => {
    expect(siteVisualAssetChangeLabel("created")).toBe("Imagem cadastrada");
    expect(siteVisualAssetChangeLabel("updated")).toBe("Imagem substituída");
    expect(siteVisualAssetChangeLabel("deleted")).toBe("Personalização removida");
  });

  it("recria a imagem com os dados da versão e o usuário atual", () => {
    expect(siteVisualAssetRestorePayload(version, "manager-2")).toEqual({
      asset_key: "/site/logo.webp",
      label: "Logo oficial",
      section: "Marca",
      default_url: "/site/logo.webp",
      image_url: "https://cdn.exemplo.com/logo-anterior.webp",
      original_image_url: "https://cdn.exemplo.com/logo-original.png",
      alt_text: "Adoce Brigaderia",
      active: true,
      updated_by: "manager-2",
    });
  });

  it("impede restaurar novamente a versão que já está ativa", () => {
    expect(siteVisualAssetVersionIsCurrent(version, version.image_url)).toBe(true);
    expect(siteVisualAssetVersionIsCurrent(version, "https://cdn.exemplo.com/outra.webp")).toBe(false);
    expect(siteVisualAssetVersionIsCurrent(version, null)).toBe(false);
  });

  it("trata datas inválidas sem quebrar a interface", () => {
    expect(siteVisualAssetVersionDate("data-inválida")).toBe("Data indisponível");
  });
});
