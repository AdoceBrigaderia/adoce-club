import { describe, expect, it } from "vitest";
import { businessDateAfter, normalizeBrazilianPhone } from "./commercial";

describe("regras comerciais", () => {
  it("calcula antecedência em dias úteis", () => {
    expect(businessDateAfter(new Date("2026-07-17T12:00:00-03:00"), 3)).toBe(
      "2026-07-22",
    );
  });

  it("normaliza WhatsApp brasileiro sem duplicar o país", () => {
    expect(normalizeBrazilianPhone("(85) 98199-4370")).toBe("5585981994370");
    expect(normalizeBrazilianPhone("+55 85 98199-4370")).toBe("5585981994370");
  });
});
