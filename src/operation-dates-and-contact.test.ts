import { describe, expect, it } from "vitest";
import { formatarDataHora, quando } from "./lib/datas";
import { formatarTelefoneBR, nomeLegivel } from "./lib/contato";

describe("rótulos operacionais de data e contato", () => {
  it("mantém Pedido em no fuso de Fortaleza e impressão em formato compacto", () => {
    expect(formatarDataHora("2026-08-11T10:37:40.174687+00:00")).toBe("11/08/2026 às 07:37");
    expect(quando("2026-08-11T10:37:40.174687+00:00")).toBe("11/08/2026 as 07h37");
  });

  it("formata o contato armazenado sem mudar o dado original", () => {
    expect(formatarTelefoneBR("+5585996239271")).toBe("(85) 99623-9271");
    expect(nomeLegivel("JosefaMaria")).toBe("Josefa Maria");
  });
});
