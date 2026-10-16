import { isRealCustomerName } from "./customer-onboarding";

export async function updateCustomerName(accessToken: string, profileId: string, fullName: string) {
  const cleanName = fullName.trim().replace(/\s+/g, " ");
  if (!isRealCustomerName(cleanName)) throw new Error("Informe o nome e sobrenome do cliente.");
  const response = await fetch("/api/customer-profile-update", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ profileId, fullName: cleanName }),
  });
  const payload = await response.json().catch(() => ({})) as { updated?: boolean; error?: string };
  if (!response.ok || !payload.updated) throw new Error(payload.error || "Não foi possível atualizar o nome.");
  return cleanName;
}

export type StaffCustomerProfileDraft = {
  fullName: string; phoneE164: string; email: string; birthDate: string;
  preferredChannel: string; postalCode: string; addressLine: string;
  addressNumber: string; addressComplement: string; neighborhood: string;
  city: string; stateCode: string;
};

export async function updateCustomerProfile(accessToken: string, profileId: string, draft: StaffCustomerProfileDraft) {
  if (!isRealCustomerName(draft.fullName)) throw new Error("Informe o nome e sobrenome do cliente.");
  const response = await fetch("/api/customer-profile-update", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ profileId, ...draft }) });
  const payload = await response.json().catch(() => ({})) as { updated?: boolean; profile?: Record<string, unknown>; error?: string; code?: string };
  if (!response.ok || !payload.updated) throw new Error(payload.error || "Não foi possível atualizar o cadastro.");
  return payload.profile;
}
