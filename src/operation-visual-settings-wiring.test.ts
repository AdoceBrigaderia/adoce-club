import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const access = readFileSync(new URL("./AccessApp.tsx", import.meta.url), "utf8");

describe("religamento da gestão de fotos do site (auditoria funcional)", () => {
  it("fica acessível como aba de Configurações, não como tela solta", () => {
    expect(access).toContain('"store" | "hours" | "team" | "visual"');
    expect(access).toContain('settingsTab === "visual"');
    expect(access).toContain("<OperationVisualSettings");
  });
});
