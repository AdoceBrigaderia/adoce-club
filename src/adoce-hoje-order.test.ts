import { describe, expect, it } from "vitest";
import { sortFlavorsByAvailability } from "./AdoceHoje";

describe("ordenação do catálogo Adoce Hoje", () => {
  it("mostra primeiro os sabores disponíveis e mantém cada grupo em ordem alfabética", () => {
    const flavors = [
      { name: "Trufado de Ninho", available: true },
      { name: "Ferrero Rocher", available: false },
      { name: "Abacaxi com Coco", available: false },
      { name: "Chocolate com Morango", available: true },
    ];

    expect(sortFlavorsByAvailability(flavors).map((flavor) => flavor.name)).toEqual([
      "Chocolate com Morango",
      "Trufado de Ninho",
      "Abacaxi com Coco",
      "Ferrero Rocher",
    ]);
  });

  it("não altera a lista original recebida do catálogo", () => {
    const flavors = [
      { name: "Oreo", available: false },
      { name: "Trufado de Ninho", available: true },
    ];

    sortFlavorsByAvailability(flavors);

    expect(flavors.map((flavor) => flavor.name)).toEqual(["Oreo", "Trufado de Ninho"]);
  });
});
