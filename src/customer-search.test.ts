import { describe, expect, it } from "vitest";
import { matchesCustomerSearch } from "./customer-search";

const customer = {
  full_name: "João da Silva",
  phone_e164: "+55 85 98215-6026",
  email: "joao.silva@example.com",
};

describe("pesquisa de clientes", () => {
  it("encontra por parte do nome sem exigir acento", () => {
    expect(matchesCustomerSearch(customer, "joa")).toBe(true);
  });

  it("encontra por parte do telefone", () => {
    expect(matchesCustomerSearch(customer, "8215")).toBe(true);
  });

  it("encontra por parte do e-mail", () => {
    expect(matchesCustomerSearch(customer, "silva@exa")).toBe(true);
  });

  it("não encontra texto de outro cliente", () => {
    expect(matchesCustomerSearch(customer, "maria")).toBe(false);
  });
});
