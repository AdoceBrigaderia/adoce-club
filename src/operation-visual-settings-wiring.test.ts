import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const access = readFileSync(new URL("./AccessApp.tsx", import.meta.url), "utf8");

describe("religamento da gestão de fotos do site (auditoria funcional)", () => {
  it("fica dentro da página única de Configurações, não como tela solta nem separada por abas", () => {
    // Decisão do proprietário em 03/11/2026: Configurações deixou de ser
    // dividida em abas -- todas as seções úteis ficam juntas, uma página só.
    expect(access).toContain('view === "settings"');
    expect(access).toContain("operation-settings-flat");
    expect(access).toContain("<OperationVisualSettings");
    expect(access).not.toContain("settingsTab");
  });
});
