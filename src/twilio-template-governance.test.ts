import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { scripts?: Record<string, string> };

describe("governanca dos templates da Twilio", () => {
  it("bloqueia criacao automatica de templates durante toda liberacao", () => {
    expect(packageJson.scripts?.["release:check"]).toContain(
      "verify-twilio-template-policy.mjs",
    );
  });
});
