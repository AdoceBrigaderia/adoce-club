import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const access = readFileSync("src/AccessApp.tsx", "utf8");
const styles = readFileSync("src/customer-account-reference-2026.css", "utf8");
const profileStart = access.indexOf('{view === "profile"');
const profileEnd = access.indexOf("{message &&", profileStart);
const profile = access.slice(profileStart, profileEnd);

describe("prioridade da Minha conta", () => {
  it("abre com os carimbos antes das ações secundárias", () => {
    expect(profile.indexOf("club-account-loyalty")).toBeGreaterThanOrEqual(0);
    expect(profile.indexOf("club-account-loyalty")).toBeLessThan(profile.indexOf("club-account-actions"));
    expect(profile).not.toContain("club-account-identity");
    expect(profile).not.toContain("club-account-heading");
  });

  it("oferece QR Code e pedido online em atalhos equivalentes", () => {
    expect(profile).toContain('aria-label="Ações principais da conta"');
    expect(profile).toContain("Gerar QR Code");
    expect(profile).toContain("Fazer pedido online");
    expect(profile).toContain('onClick={() => void openCustomerQr()}');
    expect(profile).toContain('href="/#adoce-hoje"');
    expect(styles).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
  });

  it("avisa quando existe fatia grátis disponível para resgate", () => {
    expect(profile).toContain("snapshot.rewards > 0");
    expect(profile).toContain("fatia grátis disponível");
    expect(profile).toContain("fatias grátis disponíveis");
    expect(profile).toContain("Apresente seu QR Code para resgatar no atendimento.");
    expect(styles).toContain(".club-account-reward-ready");
  });
});
