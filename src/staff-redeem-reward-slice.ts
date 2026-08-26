export async function redeemRewardSlice(
  accessToken: string,
  input: { rewardId: string; profileId: string; flavorId: string },
) {
  const response = await fetch("/api/staff-redeem-reward-slice", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    redeemed?: boolean;
    flavorName?: string;
    error?: string;
  };
  if (!response.ok || !payload.redeemed) {
    throw new Error(payload.error || "Não foi possível baixar a fatia-presente.");
  }
  return payload;
}
