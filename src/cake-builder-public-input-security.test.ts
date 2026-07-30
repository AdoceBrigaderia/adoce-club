import { describe, expect, it } from "vitest";
import { sanitizeCakeBuilder } from "../netlify/functions/_shared/cake-builder-input";

const MASSA = "11111111-1111-4111-8111-111111111111";
const RECHEIO = "22222222-2222-4222-8222-222222222222";
const COBERTURA = "33333333-3333-4333-8333-333333333333";
const FRUTA = "44444444-4444-4444-8444-444444444444";
const EXTRA = "55555555-5555-4555-8555-555555555555";

describe("entrada pública do montador de tortas", () => {
  it("preserva sabores repetidos porque cada posição representa uma camada", () => {
    const sanitized = sanitizeCakeBuilder({
      cake_layers: [MASSA, MASSA, MASSA],
      filling_layers: [RECHEIO, RECHEIO],
      topping: COBERTURA,
      filling_fruits: [],
      topping_fruits: [],
      filling_extras: [],
      topping_extras: [],
    });

    expect(sanitized).toMatchObject({
      cake_layers: [MASSA, MASSA, MASSA],
      filling_layers: [RECHEIO, RECHEIO],
      topping: COBERTURA,
    });
  });

  it("remove repetição de frutas e adicionais sem alterar a ordem das camadas", () => {
    const sanitized = sanitizeCakeBuilder({
      cake_layers: [MASSA, MASSA],
      filling_layers: [RECHEIO],
      topping: COBERTURA,
      filling_fruits: [FRUTA, FRUTA],
      topping_fruits: [FRUTA, FRUTA],
      filling_extras: [EXTRA, EXTRA],
      topping_extras: [EXTRA, EXTRA],
    });

    expect(sanitized).toEqual({
      cake_layers: [MASSA, MASSA],
      filling_layers: [RECHEIO],
      topping: COBERTURA,
      filling_fruits: [FRUTA],
      topping_fruits: [FRUTA],
      filling_extras: [EXTRA],
      topping_extras: [EXTRA],
    });
  });

  it("rejeita identificadores inválidos e limites excessivos", () => {
    expect(
      sanitizeCakeBuilder({
        cake_layers: ["massa-inventada"],
        filling_layers: [],
        topping: COBERTURA,
      }),
    ).toBeNull();

    expect(
      sanitizeCakeBuilder({
        cake_layers: Array.from({ length: 9 }, () => MASSA),
        filling_layers: [],
        topping: COBERTURA,
      }),
    ).toBeNull();
  });

  it("descarta preços, custos, template e campos inventados pelo navegador", () => {
    const sanitized = sanitizeCakeBuilder({
      template_id: "66666666-6666-4666-8666-666666666666",
      cake_layers: [MASSA],
      filling_layers: [RECHEIO],
      topping: COBERTURA,
      filling_fruits: [],
      topping_fruits: [],
      filling_extras: [],
      topping_extras: [],
      estimated_price: 1,
      estimated_internal_cost: 0,
      price_adjustment: -99999,
      unit_cost: -99999,
      role: "owner",
    });

    expect(sanitized).toEqual({
      cake_layers: [MASSA],
      filling_layers: [RECHEIO],
      topping: COBERTURA,
      filling_fruits: [],
      topping_fruits: [],
      filling_extras: [],
      topping_extras: [],
    });
  });

  it("mantém ausência de montagem como fluxo comercial comum", () => {
    expect(sanitizeCakeBuilder(undefined)).toBeUndefined();
    expect(sanitizeCakeBuilder(null)).toBeUndefined();
  });
});
