import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./SliceMenuPage.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

describe("cardápio público de fatias", () => {
  it("reúne cardápio diário, preços e horários sem uma grade semanal fixa", () => {
    for (const text of ["Cardápio de", "Sabores do dia", "Tradicionais R$ 16", "Premium R$ 20", "9h às 16h", "17h às 22h"]) expect(page).toContain(text);
    expect(page).not.toContain("Cardápio semanal");
    expect(page).not.toContain("Todos os sabores");
  });

  it("é acessível pela rota pública exclusiva", () => {
    expect(app).toContain("#cardapio-fatias");
    expect(app).toContain("<SliceMenuPage/>");
  });
});
