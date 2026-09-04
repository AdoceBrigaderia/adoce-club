import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = (file: string) =>
  fs.readFileSync(path.resolve(process.cwd(), file), "utf8");

describe("acesso local usa somente a réplica real", () => {
  it("mantém os endpoints reais e rejeita qualquer atalho fictício", () => {
    const customerEndpoint = source("netlify/functions/customer-phone-login.ts");
    const staffEndpoint = source("netlify/functions/staff-phone-login.ts");
    const auth = source("src/services/auth.ts");
    for (const endpoint of [customerEndpoint, staffEndpoint]) {
      expect(endpoint).not.toContain("HOMOLOGATION_FAKE");
      expect(endpoint).not.toContain("homologation_demo");
      // serviceClient() (de _shared/whatsapp-auth) é quem lê
      // SUPABASE_SECRET_KEY — continua sendo a chave real de serviço, só
      // deduplicada num módulo compartilhado em vez de repetida aqui.
      expect(endpoint).toContain("serviceClient()");
    }
    expect(auth).toContain('fetch("/api/customer-phone-login"');
    expect(auth).toContain('fetch("/api/staff-phone-login"');
    expect(auth).not.toContain('fetch("/.netlify/functions/customer-phone-login"');
    expect(auth).not.toContain('fetch("/.netlify/functions/staff-phone-login"');
  });

  it("não mantém interface, sessão ou variável de prévia fictícia", () => {
    const accessApp = source("src/AccessApp.tsx");
    const envTypes = source("src/vite-env.d.ts");
    expect(accessApp).not.toContain("VITE_HOMOLOGATION_FAKE_AUTH");
    expect(accessApp).not.toContain("homologationSession");
    expect(accessApp).not.toContain("Entrar na prévia local");
    expect(envTypes).not.toContain("VITE_HOMOLOGATION_FAKE_AUTH");
  });

});
