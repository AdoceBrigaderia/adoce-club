import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const liveTest = readFileSync(
  new URL("../supabase/tests/site_feedback_privacy_live.sql", import.meta.url),
  "utf8",
);

describe("ensaio vivo do feedback de privacidade", () => {
  it("valida protocolo, rota e privilégios sem persistir dados", () => {
    expect(liveTest).toContain("submit_site_feedback_bff");
    expect(liveTest).toContain("'privacy'");
    expect(liveTest).toContain("'business.privacidade'");
    expect(liveTest).toContain("has_function_privilege");
    expect(liveTest).toContain("'anon'");
    expect(liveTest).toContain("'authenticated'");
    expect(liveTest.trimStart()).toMatch(/^begin;/);
    expect(liveTest.trimEnd()).toMatch(/rollback;$/);
  });
});
