import { describe, expect, it } from "vitest";
import { customerAccountReasons } from "./customer-account-actions";

describe("customer account action reasons", () => {
  it("keeps every operational reason explicit and unique", () => {
    const values = customerAccountReasons.map((reason) => reason.value);
    expect(new Set(values).size).toBe(values.length);
    expect(values).toContain("duplicate_registration");
    expect(values).toContain("customer_request");
    expect(values).toContain("security_review");
    expect(values).toContain("other");
  });
});
