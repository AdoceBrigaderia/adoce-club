import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./FeedbackPage.tsx", import.meta.url), "utf8");
const endpoint = readFileSync(
  new URL("../netlify/functions/public-feedback.ts", import.meta.url),
  "utf8",
);
const legacyEndpoint = new URL(
  "../netlify/functions/site-feedback.ts",
  import.meta.url,
);
const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260727110000_site_feedback_bff_hardening.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("feedback público protegido pelo BFF", () => {
  it("usa same-origin e preserva uma chave idempotente durante o envio", () => {
    expect(page).toContain("const [operationKey] = useState(() => crypto.randomUUID())");
    expect(page).toContain('fetch("/api/public-feedback"');
    expect(page).toContain('credentials: "same-origin"');
    expect(page).toContain("operation_key: operationKey");
    expect(page).not.toContain("/api/site-feedback");
  });

  it("remove o endpoint antigo que aceitava bearer do navegador", () => {
    expect(existsSync(legacyEndpoint)).toBe(false);
    expect(endpoint).not.toContain('request.headers.get("authorization")');
  });

  it("valida origem, tamanho, cookie de cliente e segredo apenas no servidor", () => {
    expect(endpoint).toContain("allowedOrigin");
    expect(endpoint).toContain('request.headers.get("origin")');
    expect(endpoint).toContain("content-length");
    expect(endpoint).toContain("ACCESS_COOKIE");
    expect(endpoint).toContain("SURFACE_COOKIE");
    expect(endpoint).toContain("SUPABASE_SECRET_KEY");
    expect(endpoint).toContain("submit_site_feedback_bff");
  });

  it("serializa concorrência, cria outbox e restringe execução a service_role", () => {
    expect(migration).toContain("site_feedback_public_request_key_idx");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("where feedback.public_request_key = requested_operation_key");
    expect(migration).toContain("'site_feedback.created'");
    expect(migration).toMatch(
      /revoke all on function public\.submit_site_feedback_bff\([\s\S]*from public, anon, authenticated/,
    );
    expect(migration).toContain("to service_role");
  });
});
