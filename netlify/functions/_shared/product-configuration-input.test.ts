import { describe, expect, it } from "vitest";
import { sanitizeProductConfiguration } from "./product-configuration-input";

const first = "10000000-0000-4000-8000-000000000001";
const second = "10000000-0000-4000-8000-000000000002";

describe("sanitizeProductConfiguration", () => {
  it("preserva somente ids e quantidades válidas", () => {
    expect(
      sanitizeProductConfiguration({
        schema_version: 1,
        items: [
          { option_id: first, quantity: 60, label: "não confiar no cliente" },
          { option_id: second, quantity: 40, unit_cost: 0 },
        ],
      }),
    ).toEqual({
      schema_version: 1,
      items: [
        { option_id: first, quantity: 60 },
        { option_id: second, quantity: 40 },
      ],
    });
  });

  it("diferencia ausência de configuração de payload inválido", () => {
    expect(sanitizeProductConfiguration(undefined)).toBeUndefined();
    expect(sanitizeProductConfiguration(null)).toBeUndefined();
    expect(sanitizeProductConfiguration([])).toBeNull();
    expect(sanitizeProductConfiguration({ schema_version: 2, items: [] })).toBeNull();
  });

  it("rejeita ids duplicados e quantidades fora do limite", () => {
    expect(
      sanitizeProductConfiguration({
        schema_version: 1,
        items: [
          { option_id: first, quantity: 1 },
          { option_id: first, quantity: 2 },
        ],
      }),
    ).toBeNull();
    expect(
      sanitizeProductConfiguration({
        schema_version: 1,
        items: [{ option_id: first, quantity: 0 }],
      }),
    ).toBeNull();
    expect(
      sanitizeProductConfiguration({
        schema_version: 1,
        items: [{ option_id: first, quantity: 10_001 }],
      }),
    ).toBeNull();
  });

  it("rejeita payload excessivo", () => {
    expect(
      sanitizeProductConfiguration({
        schema_version: 1,
        items: Array.from({ length: 101 }, (_, index) => ({
          option_id: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
          quantity: 1,
        })),
      }),
    ).toBeNull();
  });
});
