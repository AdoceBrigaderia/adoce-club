import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("resumo do Clube pelo BFF", () => {
  it("mantém a sessão e as leituras de fidelidade fora do navegador", async () => {
    const client = await readFile(new URL("../src/ConnectedClubSummary.tsx", import.meta.url), "utf8");
    const endpoint = await readFile(new URL("../netlify/functions/customer-club-summary.ts", import.meta.url), "utf8");
    expect(client).toContain('fetch("/api/customer-club-summary"');
    expect(client).not.toContain("auth.getSession");
    expect(client).not.toContain("requireSupabase");
    expect(endpoint).toContain("allowedOrigin(request, env(\"SITE_URL\"))");
    expect(endpoint).toContain("auth.getUser(accessToken)");
    expect(endpoint).toContain("SUPABASE_SECRET_KEY");
  });
});
