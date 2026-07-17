export type ConsentType = "club_terms" | "privacy" | "marketing";

export type ConsentEvent = {
  consent_type: ConsentType;
  granted: boolean;
  created_at: string;
};

const PROVISIONAL_NAMES = new Set(["", "cliente adoce"]);

export function isRealCustomerName(name: string | null | undefined): boolean {
  const normalized = (name || "").trim().toLocaleLowerCase("pt-BR");
  return normalized.length >= 2 && !PROVISIONAL_NAMES.has(normalized);
}

export function currentConsent(events: ConsentEvent[], type: ConsentType): boolean {
  const latest = events
    .filter((event) => event.consent_type === type)
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))[0];

  return latest?.granted === true;
}

export function isCustomerOnboardingComplete(
  fullName: string | null | undefined,
  events: ConsentEvent[],
): boolean {
  return isRealCustomerName(fullName)
    && currentConsent(events, "club_terms")
    && currentConsent(events, "privacy");
}
