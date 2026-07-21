import { describe, expect, it } from "vitest";
import {
  businessDateAfter,
  formatCommercialDate,
  leadTimeMessage,
  normalizeBrazilianPhone,
  validateCommercialRequest,
} from "./commercial";

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

  it("explica a antecedência e informa a primeira data disponível", () => {
    expect(formatCommercialDate("2026-07-22")).toContain("22 de julho");
    expect(leadTimeMessage(3, "2026-07-22")).toContain("3 dias úteis");
    expect(leadTimeMessage(3, "2026-07-22")).toContain("22 de julho");
  });

  it("não deixa uma data antecipada virar apenas um campo vermelho", () => {
    const errors = validateCommercialRequest({
      name: "Ana",
      phone: "(85) 99999-9999",
      email: "",
      quantity: 1,
      date: "2026-07-21",
      time: "10:00",
      privacy: true,
    }, 1, "2026-07-22", 3);

    expect(errors.date).toContain("primeira data disponível");
    expect(errors.date).toContain("22 de julho");
  });

  it("explica todos os campos obrigatórios do pedido", () => {
    const errors = validateCommercialRequest({
      name: "",
      phone: "85",
      email: "email-incompleto",
      quantity: 0,
      date: "",
      time: "",
      privacy: false,
    }, 15, "2026-07-28", 5);

    expect(Object.keys(errors)).toEqual(["name", "phone", "email", "quantity", "date", "time", "privacy"]);
  });
});
