import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

describe("Clube conectado na página inicial", () => {
  it("lê a sessão persistida e mostra o saldo real do cliente", () => {
    const summary = source("./ConnectedClubSummary.tsx");
    const landing = source("./MarketingLanding.tsx");
    const header = source("./PublicHeader.tsx");

    expect(summary).toContain("supabase.auth.getSession()");
    expect(summary).toContain("supabase.auth.onAuthStateChange");
    expect(summary).toContain('.from("loyalty_tracks")');
    expect(summary).toContain("Meus carimbos");
    expect(landing).not.toContain("ConnectedHomeClubCard");
    expect(landing).not.toContain("<PublicHeader");
    expect(header).toContain("public-member-greeting");
    expect(header).toContain("progress} de 14 carimbos");
    expect(header).toContain('`${accountHref}?view=qr`');
  });

  it("oferece cartão, QR e preferências sem voltar ao login", () => {
    const summary = source("./ConnectedClubSummary.tsx");
    const header = source("./PublicHeader.tsx");

    expect(summary).toContain('href="/#minha-conta"');
    expect(summary).toContain('href="/#minha-conta?view=qr"');
    expect(summary).toContain('href="/#minha-conta?view=profile"');
    expect(header).toContain("Abrir meu QR Code");
    expect(header).toContain("Abrir menu");
  });

  it("explica claramente a opção de manter a sessão", () => {
    const access = source("./AccessApp.tsx");
    const supabase = source("./lib/supabase.ts");

    expect(access).toContain("Manter conectado");
    expect(access).toContain("até você escolher “Sair”");
    expect(supabase).toContain("persistSession: true");
    expect(supabase).toContain("getRememberLoginPreference");
  });
});
