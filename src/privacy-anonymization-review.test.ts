import { describe, expect, it } from "vitest";
import {
  attachPrivacyReviewWindow,
  PRIVACY_REVIEW_VALIDITY_MS,
  privacyReviewIsFresh,
} from "./privacy-anonymization-review";

describe("janela de revisão da anonimização", () => {
  it("registra início e expiração em cinco minutos", () => {
    const now = Date.UTC(2026, 6, 27, 12, 0, 0);
    const reviewed = attachPrivacyReviewWindow({ ready: true }, now);

    expect(reviewed.reviewed_at).toBe(new Date(now).toISOString());
    expect(reviewed.expires_at).toBe(
      new Date(now + PRIVACY_REVIEW_VALIDITY_MS).toISOString(),
    );
    expect(reviewed.ready).toBe(true);
  });

  it("aceita revisão antes da expiração e rejeita no limite", () => {
    const now = Date.UTC(2026, 6, 27, 12, 0, 0);
    const reviewed = attachPrivacyReviewWindow({}, now);

    expect(privacyReviewIsFresh(reviewed, now + PRIVACY_REVIEW_VALIDITY_MS - 1)).toBe(
      true,
    );
    expect(privacyReviewIsFresh(reviewed, now + PRIVACY_REVIEW_VALIDITY_MS)).toBe(
      false,
    );
  });

  it("falha de forma segura para plano ausente ou data inválida", () => {
    expect(privacyReviewIsFresh(undefined)).toBe(false);
    expect(privacyReviewIsFresh(null)).toBe(false);
    expect(privacyReviewIsFresh({ expires_at: "data-inválida" })).toBe(false);
  });
});
