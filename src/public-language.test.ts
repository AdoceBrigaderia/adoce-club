import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("linguagem pública da Adoce", () => {
  const today = readFileSync(new URL("./AdoceHoje.tsx", import.meta.url), "utf8");

  it("fala em disponibilidade de sabores em vez de termos internos", () => {
    expect(today).toContain("Sabores disponíveis agora");
    expect(today).toContain("Disponíveis hoje");
    expect(today).toContain("Disponível hoje");
    expect(today).not.toContain("Sinalizados hoje");
    expect(today).not.toContain("Sinalizado hoje");
  });
});
