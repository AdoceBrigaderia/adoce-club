import { describe, expect, it } from "vitest";
import { SITE_VISUAL_ASSETS, siteVisualAssetKeys } from "./site-visual-assets";
import { replaceVisualAssetUrls } from "./site-visual-css-overrides";

const textureKey = "/site/chocolate-texture.webp";
const replacement = "https://cdn.exemplo.com/identidade/textura.webp";

describe("imagens administráveis usadas dentro do CSS", () => {
  it("registra a textura de chocolate na Biblioteca Central", () => {
    const texture = SITE_VISUAL_ASSETS.find((asset) => asset.key === textureKey);
    expect(texture).toMatchObject({
      section: "Marca",
      aspectWidth: 1,
      aspectHeight: 1,
      usage: expect.stringContaining("Fundos escuros"),
    });
  });

  it("substitui URL relativa dentro de background com gradiente", () => {
    const css = `linear-gradient(#0008,#0008), url('${textureKey}') center/cover`;
    expect(replaceVisualAssetUrls(css, new Map([[textureKey, replacement]]), siteVisualAssetKeys)).toBe(
      `linear-gradient(#0008,#0008), url("${replacement}") center/cover`,
    );
  });

  it("substitui URL absoluta que aponta para a mesma imagem administrável", () => {
    const css = `url("https://www.adocebrigaderia.com.br${textureKey}")`;
    expect(replaceVisualAssetUrls(css, new Map([[textureKey, replacement]]), siteVisualAssetKeys)).toBe(
      `url("${replacement}")`,
    );
  });

  it("preserva imagens que ainda não fazem parte do catálogo", () => {
    const css = `url('/site/nao-cadastrada.webp')`;
    expect(replaceVisualAssetUrls(css, new Map([[textureKey, replacement]]), siteVisualAssetKeys)).toBe(css);
  });

  it("preserva o CSS original quando não há personalização ativa", () => {
    const css = `url('${textureKey}')`;
    expect(replaceVisualAssetUrls(css, new Map(), siteVisualAssetKeys)).toBe(css);
  });
});
