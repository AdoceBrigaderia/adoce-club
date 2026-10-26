import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("politica de origem unica de producao", () => {
  it("nao oferece publicacao em homologacao online", () => {
    const packageJson = read("package.json");
    expect(packageJson).not.toContain('"release:preview"');
    expect(packageJson).not.toContain("--alias=homologacao");
    expect(packageJson).toContain("verify-online-environment-policy.mjs");
    const guard = read("scripts/verify-online-environment-policy.mjs");
    expect(guard).toContain('["adoce", "homologacao"].join("-")');
    expect(guard).toContain("release:preview");
  });

  it("nao permite que SITE_URL altere links ou origens das Functions", () => {
    const files = [
      "netlify/functions/_meta-catalog-service.ts",
      "netlify/functions/_shared/access-link.ts",
      "netlify/functions/_shared/whatsapp-auth.ts",
      "netlify/functions/customer-account-action.ts",
      "netlify/functions/customer-phone-login.ts",
      "netlify/functions/customer-profile-update.ts",
      "netlify/functions/customer-security-upgrade.ts",
      "netlify/functions/request-email-code.ts",
      "netlify/functions/request-password-reset.ts",
      "netlify/functions/staff-access-code.ts",
      "netlify/functions/staff-create-customer.ts",
      "netlify/functions/staff-phone-login.ts",
      "netlify/functions/verify-email-code.ts",
    ];
    for (const file of files) {
      expect(read(file), file).not.toContain('env("SITE_URL")');
    }
  });

  it("nao inclui login falso de homologacao no aplicativo", () => {
    expect(read("src/AccessApp.tsx")).not.toContain("VITE_HOMOLOGATION_FAKE_AUTH");
    expect(read("src/services/auth.ts")).not.toContain("homologation_demo");
    expect(read("netlify/functions/customer-phone-login.ts")).not.toContain("HOMOLOGATION_FAKE");
    expect(read("netlify/functions/staff-phone-login.ts")).not.toContain("HOMOLOGATION_FAKE");
  });

  it("bloqueia a URL antiga em codigo executavel e configuracao", () => {
    const files = [
      "package.json",
      ".env.example",
      "netlify.toml",
      "src/AccessApp.tsx",
      "src/services/auth.ts",
      "netlify/functions/_shared/access-link.ts",
      "netlify/functions/staff-create-customer.ts",
    ];
    for (const file of files) {
      expect(read(file), file).not.toMatch(/adoce-homologacao\.netlify\.app/i);
    }
  });
});
