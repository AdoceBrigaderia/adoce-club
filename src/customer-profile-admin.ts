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
