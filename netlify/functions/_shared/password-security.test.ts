import { describe, expect, it } from "vitest";
import {
  generateTemporaryPassword,
  isStrongTemporaryPassword,
} from "./password-security";

describe("senhas temporárias administrativas", () => {
  it("gera senhas fortes e sem padrão fixo", () => {
    const passwords = Array.from({ length: 64 }, () => generateTemporaryPassword());

    expect(new Set(passwords).size).toBe(passwords.length);
    passwords.forEach((password) => {
      expect(password).toHaveLength(20);
      expect(isStrongTemporaryPassword(password)).toBe(true);
      expect(password).not.toBe("123456@adoce");
    });
  });

  it("recusa comprimentos inseguros", () => {
    expect(() => generateTemporaryPassword(10)).toThrow(/entre 12 e 64/);
    expect(() => generateTemporaryPassword(65)).toThrow(/entre 12 e 64/);
  });
});
