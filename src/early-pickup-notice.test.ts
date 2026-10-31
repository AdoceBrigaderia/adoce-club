import { describe, expect, it } from "vitest";
import { EARLY_PICKUP_NOTICE, shouldShowEarlyPickupNotice } from "./early-pickup-notice";

describe("aviso de retirada antes das 18h", () => {
  it("é obrigatório somente antes das 18h", () => {
    expect(shouldShowEarlyPickupNotice("17:59")).toBe(true);
    expect(shouldShowEarlyPickupNotice("18:00")).toBe(false);
    expect(shouldShowEarlyPickupNotice("20:30")).toBe(false);
  });

  it("informa a liberação das fatias após as 18h30", () => {
    expect(EARLY_PICKUP_NOTICE).toContain("após as 18h30");
  });
});
