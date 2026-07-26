import { describe, expect, it } from "vitest";
import { installExperienceAssets } from "./browser-bootstrap";

describe("bootstrap instalável sem script inline", () => {
  it("seleciona os recursos da operação", () => {
    expect(installExperienceAssets("#operacao")).toEqual({
      manifestHref: "/manifest-operacao.webmanifest",
      iconHref: "/pwa/operacao/icon-192.png",
      appleTouchIconHref: "/pwa/operacao/apple-touch-icon.png",
      appTitle: "Adoce Operação",
    });
  });

  it("mantém os recursos do Clube nas páginas públicas", () => {
    expect(installExperienceAssets("#adoce-hoje")).toEqual({
      manifestHref: "/manifest-clube.webmanifest",
      iconHref: "/pwa/clube/icon-192.png",
      appleTouchIconHref: "/pwa/clube/apple-touch-icon.png",
      appTitle: "Clube Adoce",
    });
  });
});
