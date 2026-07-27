export const PRIVACY_REVIEW_VALIDITY_MS = 5 * 60 * 1000;

export type PrivacyReviewWindow = {
  reviewed_at: string;
  expires_at: string;
};

export function attachPrivacyReviewWindow<T extends object>(
  plan: T,
  now = Date.now(),
): T & PrivacyReviewWindow {
  return {
    ...plan,
    reviewed_at: new Date(now).toISOString(),
    expires_at: new Date(now + PRIVACY_REVIEW_VALIDITY_MS).toISOString(),
  };
}

export function privacyReviewIsFresh(
  plan: Pick<PrivacyReviewWindow, "expires_at"> | null | undefined,
  now = Date.now(),
) {
  if (!plan) return false;
  const expiresAt = Date.parse(plan.expires_at);
  return Number.isFinite(expiresAt) && expiresAt > now;
}
