import { describe, expect, it } from "vitest";
import { capitalizeNameInitials } from "./customer-name";

describe("capitalização do nome do cliente", () => {
  it("coloca automaticamente em maiúscula a inicial de cada nome", () => {
    expect(capitalizeNameInitials("rubens bezerra")).toBe("Rubens Bezerra");
    expect(capitalizeNameInitials("maria da silva")).toBe("Maria Da Silva");
    expect(capitalizeNameInitials("ana-clara d'ávila")).toBe("Ana-Clara D'Ávila");
  });
});
