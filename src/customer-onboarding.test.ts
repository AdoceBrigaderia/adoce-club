import { describe, expect, it } from "vitest";
import { currentConsent, isCustomerOnboardingComplete, isRealCustomerName } from "./customer-onboarding";

const requiredConsents = [
  { consent_type: "club_terms" as const, granted: true, created_at: "2026-07-17T10:00:00Z" },
  { consent_type: "privacy" as const, granted: true, created_at: "2026-07-17T10:00:01Z" },
];

describe("conclusão do cadastro do cliente", () => {
  it("rejeita o nome provisório criado automaticamente", () => {
    expect(isRealCustomerName("Cliente Adoce")).toBe(false);
    expect(isCustomerOnboardingComplete("Cliente Adoce", requiredConsents)).toBe(false);
  });

  it("não libera o cartão sem os dois consentimentos obrigatórios", () => {
    expect(isCustomerOnboardingComplete("Marcos Bezerra", requiredConsents.slice(0, 1))).toBe(false);
  });

  it("considera o evento mais recente em caso de revogação", () => {
    const events = [
      ...requiredConsents,
      { consent_type: "privacy" as const, granted: false, created_at: "2026-07-17T11:00:00Z" },
    ];

    expect(currentConsent(events, "privacy")).toBe(false);
    expect(isCustomerOnboardingComplete("Marcos Bezerra", events)).toBe(false);
  });

  it("libera somente um cadastro nominal com termos e privacidade aceitos", () => {
    expect(isCustomerOnboardingComplete("Marcos Bezerra", requiredConsents)).toBe(true);
  });
});
