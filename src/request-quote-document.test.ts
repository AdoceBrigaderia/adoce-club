import { describe, expect, it } from "vitest";
import { parsePreferences } from "./RequestQuoteDocument";

describe("or?amento: leitura do que a cliente pediu", () => {
  it("quebra o pedido real da Gabriela em linhas", () => {
    const items = parsePreferences(
      "100 docinhos ( 25 ninho, 25 brigadeiro, 25 beijinho e 25 nesquik)",
    );
    expect(items).toEqual([
      { quantity: 25, description: "ninho" },
      { quantity: 25, description: "brigadeiro" },
      { quantity: 25, description: "beijinho" },
      { quantity: 25, description: "nesquik" },
    ]);
  });

  it("soma das linhas bate com o total pedido", () => {
    const items = parsePreferences(
      "100 docinhos ( 25 ninho, 25 brigadeiro, 25 beijinho e 25 nesquik)",
    );
    expect(items.reduce((sum, item) => sum + (item.quantity || 0), 0)).toBe(100);
  });

  it("aceita ponto e v?rgula e quebra de linha", () => {
    expect(parsePreferences("30 beijinho; 20 brigadeiro\n10 ninho")).toEqual([
      { quantity: 30, description: "beijinho" },
      { quantity: 20, description: "brigadeiro" },
      { quantity: 10, description: "ninho" },
    ]);
  });

  it("aceita unidades escritas de outras formas", () => {
    expect(parsePreferences("(12 un. ninho, 8x brigadeiro)")).toEqual([
      { quantity: 12, description: "ninho" },
      { quantity: 8, description: "brigadeiro" },
    ]);
  });

  it("preserva texto livre quando n?o h? lista", () => {
    expect(parsePreferences("Bolo de dois andares tema jardim")).toEqual([
      { quantity: null, description: "Bolo de dois andares tema jardim" },
    ]);
  });

  it("n?o quebra com campo vazio", () => {
    expect(parsePreferences("")).toEqual([]);
    expect(parsePreferences("   ")).toEqual([]);
  });

  it("n?o confunde 'e' de palavra com separador", () => {
    const items = parsePreferences("(10 doce de leite e coco, 5 ninho)");
    expect(items).toEqual([
      { quantity: 10, description: "doce de leite e coco" },
      { quantity: 5, description: "ninho" },
    ]);
  });
});
