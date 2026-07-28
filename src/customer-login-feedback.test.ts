import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("acesso do cliente por celular e senha", () => {
  it("remove o restaurador de sessão legado e usa somente o gateway BFF", () => {
    expect(existsSync(new URL("./services/auth.ts", import.meta.url))).toBe(false);
    const gateway = source("./PasskeyClientGateway.tsx");
    const bffAuth = source("./services/bff-auth.ts");
    expect(gateway).toContain("bffPasswordLogin");
    expect(gateway).toContain('surface: "client"');
    expect(bffAuth).toContain('fetch("/api/auth-bff-login"');
    expect(bffAuth).toContain('credentials: "same-origin"');
    expect(bffAuth).not.toContain("auth.setSession");
    expect(bffAuth).not.toContain("access_token");
    expect(bffAuth).not.toContain("refresh_token");
  });

  it("desativa o endpoint legado que devolvia tokens no corpo", () => {
    const customerEndpoint = source(
      "../netlify/functions/customer-phone-login.ts",
    );
    const staffEndpoint = source("../netlify/functions/staff-phone-login.ts");
    [customerEndpoint, staffEndpoint].forEach((endpoint) => {
      expect(endpoint).toContain("legacy_phone_login_disabled");
      expect(endpoint).toContain("410");
      expect(endpoint).not.toContain("access_token");
      expect(endpoint).not.toContain("refresh_token");
      expect(endpoint).not.toContain("grant_type=password");
    });
  });
});

describe("canal de reclamações e sugestões", () => {
  it("é público para envio pelo BFF, mas a tabela só pode ser lida pela equipe", () => {
    const baseMigration = source(
      "../supabase/migrations/20260720132544_customer_feedback.sql",
    );
    const bffMigration = source(
      "../supabase/migrations/20260727041258_site_feedback_bff_hardening.sql",
    );
    const app = source("./App.tsx");
    const endpoint = source("../netlify/functions/public-feedback.ts");
    expect(baseMigration).toContain("enable row level security");
    expect(baseMigration).toContain(
      "revoke all on table public.site_feedback from public, anon, authenticated",
    );
    expect(baseMigration).toContain("using (private.is_staff())");
    expect(app).toContain('hash.startsWith("#fale-com-a-adoce")');
    expect(endpoint).toContain("submit_site_feedback_bff");
    expect(endpoint).toContain("allowedOrigin");
    expect(bffMigration).toContain("to service_role");
  });
});
