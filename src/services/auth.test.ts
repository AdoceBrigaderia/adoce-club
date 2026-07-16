import { describe, expect, it } from "vitest";
import { normalizeBrazilPhone } from "./auth";

describe("normalizeBrazilPhone", () => {
  it("normaliza celular brasileiro", () => {
    expect(normalizeBrazilPhone("(11) 99999-0000")).toBe("+5511999990000");
  });

  it("preserva o código do Brasil", () => {
    expect(normalizeBrazilPhone("+55 11 99999-0000")).toBe("+5511999990000");
  });

  it("rejeita telefone incompleto", () => {
    expect(() => normalizeBrazilPhone("9999-0000")).toThrow("DDD");
  });
});