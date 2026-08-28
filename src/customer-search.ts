export type SearchableCustomer = {
  full_name: string;
  phone_e164: string | null;
  email: string | null;
  member_code: string | null;
};

export type CustomerProfileIdentity = {
  id: string;
  account_status: string | null;
};

export function isCustomerProfile(
  profile: CustomerProfileIdentity,
  staffIds: ReadonlySet<string>,
): boolean {
  return !staffIds.has(profile.id) && profile.account_status !== "anonymized";
}

export function countCustomerProfiles(
  profiles: readonly CustomerProfileIdentity[],
  staffIds: ReadonlySet<string>,
): number {
  return profiles.filter((profile) => isCustomerProfile(profile, staffIds)).length;
}

export function normalizeSearchValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

export function matchesCustomerSearch(customer: SearchableCustomer, query: string): boolean {
  const normalized = normalizeSearchValue(query);
  if (!normalized) return true;

  const digits = query.replace(/\D/g, "");
  const searchableText = [
    customer.full_name,
    customer.email || "",
    customer.member_code || "",
  ]
    .map(normalizeSearchValue)
    .join(" ");

  return searchableText.includes(normalized)
    || Boolean(digits && (customer.phone_e164 || "").replace(/\D/g, "").includes(digits));
}
