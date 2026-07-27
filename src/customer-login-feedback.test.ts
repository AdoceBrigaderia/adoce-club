import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("acesso do cliente por celular e senha", () => {
  it("usa o endpoint seguro e restaura a sessão no navegador", () => {
    const auth = source("./services/auth.ts");
    expect(auth).toContain('fetch("/api/customer-phone-login"');
    expect(auth).toContain("auth.setSession");
    expect(auth).not.toContain("signInWithPassword({\n    phone:");
  });

  it("mantém a identificação interna fora da resposta de erro", () => {
    const endpoint = source("../netlify/functions/customer-phone-login.ts");
    expect(endpoint).toContain('.from("profiles")');
    expect(endpoint).toContain("id,active,account_status,auth_upgraded_at");
    expect(endpoint).toContain("must_change_password");
    expect(endpoint).toContain("temporary_password_expires_at");
    expect(endpoint).toContain("auth.admin.getUserById");
    expect(endpoint).toContain("/auth/v1/token?grant_type=password");
    expect(endpoint).toContain('json({ error: "Celular ou senha incorretos." }, 401)');
    expect(endpoint).toContain("temporary_password_expired");
  });
});

describe("canal de reclamações e sugestões", () => {
  it("é público para envio pelo BFF, mas a tabela só pode ser lida pela equipe", () => {
    const baseMigration = source(
      "../supabase/migrations/20260720132544_customer_feedback.sql",
    );
    const bffMigration = source(
      "../supabase/migrations/20260727110000_site_feedback_bff_hardening.sql",
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
