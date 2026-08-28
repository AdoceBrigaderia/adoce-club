import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const access = readFileSync(new URL("./AccessApp.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./customer-v3.css", import.meta.url), "utf8");

describe("experiência 2026 das telas do cliente", () => {
  it("mantém o novo visual isolado da operação", () => {
    expect(access).toContain('import "./customer-v3.css"');
    expect(styles).toContain(".access-page.client");
    expect(styles).toContain(".club-home");
    expect(styles).not.toContain(".operation-home");
  });

  it("transforma o QR pessoal em uma janela protegida e acessível", () => {
    expect(access).toContain('className="club-qr-backdrop"');
    expect(access).toContain('role="dialog"');
    expect(access).toContain('aria-modal="true"');
    expect(access).toContain('event.key === "Escape"');
    expect(access).toContain('event.key !== "Tab"');
    expect(styles).toContain("body.club-modal-open");
  });

  it("permite mostrar a senha também durante criação e recuperação", () => {
    expect(access).toContain("showSecurityPassword");
    expect(access).toContain('type={showSecurityPassword ? "text" : "password"}');
    expect(access).toContain("Mostrar confirmação da senha");
  });

  it("oferece navegação móvel compatível com as ações principais", () => {
    expect(access).toContain("<Heart /> Início");
    expect(access).toContain("<CakeSlice /> Sabores");
    expect(access).toContain("<Settings2 /> Preferências");
    expect(styles).toContain("grid-template-columns: repeat(5, minmax(0, 1fr))");
  });

  it("abre o Clube pelo benefício e reúne configurações em preferências", () => {
    expect(access.indexOf("club-member-start")).toBeLessThan(
      access.indexOf("club-how-reward"),
    );
    expect(access).toContain("Meus carimbos");
    expect(access).toContain("Ver sabores de hoje");
    expect(access).toContain("Preferências e configurações");
    expect(access).toContain("Sair deste aparelho");
    expect(styles).toContain(".club-member-start");
  });

  it("reinicia as telas do cliente no topo em cada mudança de etapa", () => {
    expect(access).toContain('window.scrollTo({ top: 0, left: 0, behavior: "auto" })');
    expect(access).toContain("[loginMode, registering, stage, surface]");
    expect(access).toContain("securityUpgradeRequired");
  });
});
