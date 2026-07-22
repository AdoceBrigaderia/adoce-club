import { describe, expect, it } from "vitest";
import { sortFlavorsByAvailability, type Availability } from "./OperationContentAdmin";

const flavors = [
  { id: "a", name: "Abacaxi", active: true },
  { id: "z", name: "Trufado de Ninho", active: true },
  { id: "c", name: "Chocolatudo", active: true },
] as Parameters<typeof sortFlavorsByAvailability>[0];

describe("ordenação da disponibilidade na operação", () => {
  it("coloca sabores disponíveis antes dos indisponíveis", () => {
    const availability = [
      { flavor_id: "z", status: "available", quantity_available: 9, quantity_reserved: 0, note: null },
      { flavor_id: "c", status: "last_units", quantity_available: 2, quantity_reserved: 0, note: null },
    ] as Availability[];

    expect(sortFlavorsByAvailability(flavors, availability).map((item) => item.id)).toEqual(["z", "c", "a"]);
  });
});
