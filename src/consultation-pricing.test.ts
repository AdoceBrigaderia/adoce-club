import { describe, expect, it } from "vitest";
import { isPriceOnRequest } from "./consultation-pricing";

describe("preço sob consulta", () => {
  it("reconhece somente a Torta de Pudim", () => {
    expect(isPriceOnRequest("Torta de Pudim")).toBe(true);
    expect(isPriceOnRequest(" torta de pudim ")).toBe(true);
    expect(isPriceOnRequest("Palha Italiana")).toBe(false);
  });
});
