import { describe, expect, it } from "vitest";
import { publicContactLinks, publicContactWhatsAppMessage, shouldShowPublicContactDock } from "./public-contact-links";

describe("contatos públicos da Adoce", () => {
  it("usa os canais oficiais e o segundo WhatsApp com mensagem inicial", () => {
    expect(publicContactLinks.facebook).toBe("https://www.facebook.com/adocebrigaderia");
    expect(publicContactLinks.instagram).toBe("https://www.instagram.com/_adocebrigaderia_/");
    expect(publicContactLinks.whatsappSecondary).toContain("wa.me/5585982156026");
    expect(publicContactWhatsAppMessage).toContain("Vim pelo site da Adoce");
  });

  it("exibe os contatos nas páginas públicas e nunca na operação", () => {
    expect(shouldShowPublicContactDock("www.adocebrigaderia.com.br", "#eventos")).toBe(true);
    expect(shouldShowPublicContactDock("www.adocebrigaderia.com.br", "#pede-junto")).toBe(true);
    expect(shouldShowPublicContactDock("operacao.adocebrigaderia.com.br", "")).toBe(false);
    expect(shouldShowPublicContactDock("www.adocebrigaderia.com.br", "#operacao")).toBe(false);
    expect(shouldShowPublicContactDock("www.adocebrigaderia.com.br", "#campanha-feed")).toBe(false);
    expect(shouldShowPublicContactDock("www.adocebrigaderia.com.br", "#entrar")).toBe(false);
    expect(shouldShowPublicContactDock("www.adocebrigaderia.com.br", "#cadastro")).toBe(false);
    expect(shouldShowPublicContactDock("www.adocebrigaderia.com.br", "#fale-com-a-adoce")).toBe(false);
  });
});
