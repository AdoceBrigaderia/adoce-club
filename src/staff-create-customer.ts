export type StaffCreatedCustomer = {
  profileId: string;
  accountId: string | null;
  fullName: string;
  phone: string;
  existing: boolean;
  temporaryPassword?: string;
  loginUrl?: string;
  accessMessage?: string;
  whatsappUrl?: string;
};

export async function createStaffCustomer(
  accessToken: string,
  fullName: string,
  phone: string,
): Promise<StaffCreatedCustomer> {
  const response = await fetch("/api/staff-create-customer", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fullName, phone }),
  });
  const payload = (await response.json().catch(() => ({}))) as StaffCreatedCustomer & {
    error?: string;
  };
  if (!response.ok || !payload.profileId) {
    throw new Error(payload.error || "Não foi possível cadastrar o cliente agora.");
  }
  return payload;
}
