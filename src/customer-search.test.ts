import { describe, expect, it } from "vitest";
import { activeCustomerProfilesForCounter, countCustomerProfiles, isCustomerProfile, matchesCustomerSearch } from "./customer-search";

const customer = {
  full_name: "João da Silva",
  phone_e164: "+55 85 98215-6026",
  email: "joao.silva@example.com",
  member_code: "ADOC 2026 0000 0123",
};

describe("pesquisa de clientes", () => {
  it("usa a mesma regra da lista para separar clientes, equipe e anonimizados", () => {
    const staffIds = new Set(["staff-1"]);
    expect(isCustomerProfile({ id: "customer-1", account_status: "active" }, staffIds)).toBe(true);
    expect(isCustomerProfile({ id: "staff-1", account_status: "active" }, staffIds)).toBe(false);
    expect(isCustomerProfile({ id: "customer-2", account_status: "anonymized" }, staffIds)).toBe(false);
  });

  it("faz o contador do painel excluir equipe e cadastros anonimizados", () => {
    const staffIds = new Set(["staff-1", "staff-2"]);
    const profiles = [
      { id: "customer-1", account_status: "active" },
      { id: "customer-2", account_status: "pending_deletion" },
      { id: "staff-1", account_status: "active" },
      { id: "staff-2", account_status: "active" },
      { id: "removed-1", account_status: "anonymized" },
    ];

    expect(countCustomerProfiles(profiles, staffIds)).toBe(2);
  });

  it("mantém todos os clientes ativos na busca rápida, inclusive depois da primeira página", () => {
    const profiles = Array.from({ length: 60 }, (_, index) => ({
      id: `customer-${index}`,
      account_status: "active",
      full_name: index === 59 ? "Gabriela da Silva" : `Cliente ${index}`,
    }));

    const directory = activeCustomerProfilesForCounter(profiles, new Set());

    expect(directory).toHaveLength(60);
    expect(directory.some((profile) => profile.full_name.includes("Gabriela"))).toBe(true);
  });
  it("encontra por parte do nome sem exigir acento", () => {
    expect(matchesCustomerSearch(customer, "joa")).toBe(true);
  });

  it("encontra por parte do telefone", () => {
    expect(matchesCustomerSearch(customer, "8215")).toBe(true);
  });

  it("encontra por parte do e-mail", () => {
    expect(matchesCustomerSearch(customer, "silva@exa")).toBe(true);
  });

  it("encontra pelo Código do Membro completo ou parcial", () => {
    expect(matchesCustomerSearch(customer, "ADOC 2026 0000 0123")).toBe(true);
    expect(matchesCustomerSearch(customer, "0123")).toBe(true);
  });

  it("não encontra texto de outro cliente", () => {
    expect(matchesCustomerSearch(customer, "maria")).toBe(false);
  });
});
