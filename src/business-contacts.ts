export const BUSINESS_CONTACTS = {
  atendimento: {
    email: "atendimento@adocebrigaderia.com.br",
    label: "Atendimento Adoce",
  },
  privacidade: {
    email: "privacidade@adocebrigaderia.com.br",
    label: "Privacidade Adoce",
  },
} as const;

export type BusinessContactKey = keyof typeof BUSINESS_CONTACTS;

export function businessMailto(
  contact: BusinessContactKey,
  subject?: string,
) {
  const address = BUSINESS_CONTACTS[contact].email;
  const query = subject?.trim()
    ? `?subject=${encodeURIComponent(subject.trim())}`
    : "";
  return `mailto:${address}${query}`;
}
