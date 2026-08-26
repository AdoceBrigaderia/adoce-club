import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = (file: string) =>
  fs.readFileSync(path.resolve(process.cwd(), file), "utf8");

describe("acesso fictício isolado da homologação", () => {
  it("mantém usuário e senha somente no servidor da homologação", () => {
    const customerEndpoint = source("netlify/functions/customer-phone-login.ts");
    const staffEndpoint = source("netlify/functions/staff-phone-login.ts");
    const auth = source("src/services/auth.ts");
    for (const endpoint of [customerEndpoint, staffEndpoint]) {
      expect(endpoint).toContain('env("HOMOLOGATION_FAKE_USER")');
      expect(endpoint).toContain('env("HOMOLOGATION_FAKE_PASSWORD")');
      expect(endpoint).toContain("difference |=");
      expect(endpoint).toContain("homologation_demo: true");
    }
    expect(auth).toContain('fetch("/api/customer-phone-login"');
    expect(auth).toContain('fetch("/api/staff-phone-login"');
    expect(auth).not.toContain('fetch("/.netlify/functions/customer-phone-login"');
    expect(auth).not.toContain('fetch("/.netlify/functions/staff-phone-login"');
  });

  it("não habilita a conta fictícia sem a flag exclusiva", () => {
    const endpoint = source("netlify/functions/customer-phone-login.ts");
    const accessApp = source("src/AccessApp.tsx");
    expect(endpoint).toContain(
      'env("HOMOLOGATION_FAKE_LOGIN_ENABLED") === "true"',
    );
    expect(accessApp).toContain('VITE_HOMOLOGATION_FAKE_AUTH === "true"');
  });

});
