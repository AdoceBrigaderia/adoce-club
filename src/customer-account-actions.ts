export type CustomerAccountAction =
  | "deactivate"
  | "reactivate"
  | "request_deletion"
  | "mark_duplicate"
  | "cancel_deletion";

export type CustomerAccountReason =
  | "duplicate_registration"
  | "customer_request"
  | "created_by_mistake"
  | "security_review"
  | "terms_violation"
  | "legal_requirement"
  | "other";

export const customerAccountReasons: Array<{ value: CustomerAccountReason; label: string }> = [
  { value: "duplicate_registration", label: "Cadastro duplicado" },
  { value: "customer_request", label: "Solicitação do cliente" },
  { value: "created_by_mistake", label: "Cadastro criado por engano ou teste" },
  { value: "security_review", label: "Revisão de segurança" },
  { value: "terms_violation", label: "Violação dos termos" },
  { value: "legal_requirement", label: "Obrigação legal ou administrativa" },
  { value: "other", label: "Outro motivo" },
];

export async function applyCustomerAccountAction(
  accessToken: string,
  input: {
    profileId: string;
    action: CustomerAccountAction;
    reasonCode: CustomerAccountReason;
    reasonNote?: string;
  },
) {
  const response = await fetch("/api/customer-account-action", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    applied?: boolean;
    resultingStatus?: string;
    notificationStatus?: string;
    error?: string;
  };
  if (!response.ok || !payload.applied) {
    throw new Error(payload.error || "Não foi possível atualizar o cadastro.");
  }
  return payload;
}
