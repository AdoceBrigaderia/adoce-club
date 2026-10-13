export type CashCustomer = {
  profile_id: string;
  account_id: string;
  full_name: string;
  phone_e164: string | null;
  current_progress: number;
  available_rewards: number;
  available_reward_id: string | null;
};

export const normalizeCashPhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
};

export function resolveLoyaltyMode(input: { customerId: string; manualUnitKey: string; digitalUnitKey: string }) {
  return { manualUnitKey: input.customerId ? "" : input.manualUnitKey, manualDisabled: Boolean(input.customerId) };
}

export function rewardUnitOptions(lines: Array<{ flavorId: string; name: string; quantity: number }>) {
  return lines.flatMap((line) => Array.from({ length: line.quantity }, (_, index) => ({
    key: `${line.flavorId}:${index + 1}`,
    flavorId: line.flavorId,
    unitNumber: index + 1,
    label: `${line.name} · fatia ${index + 1}`,
  })));
}
