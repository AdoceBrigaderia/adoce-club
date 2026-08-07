import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { extractInstagramEvents, validMetaSignature } from "../netlify/functions/_meta-webhook";

describe("Instagram webhook foundation", () => {
  it("validates the official sha256 signature without exposing the secret", async () => {
    const body = JSON.stringify({ object: "instagram", entry: [] });
    const secret = "local-test-secret";
    const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
    await expect(validMetaSignature(body, signature, secret)).resolves.toBe(true);
    await expect(validMetaSignature(`${body}x`, signature, secret)).resolves.toBe(false);
  });

  it("uses the Meta message id as the idempotency key", async () => {
    const events = await extractInstagramEvents({
      object: "instagram",
      entry: [{
        id: "17890000000000000",
        time: 1_786_000_000,
        messaging: [{
          sender: { id: "sender-1" },
          recipient: { id: "17890000000000000" },
          timestamp: 1_786_000_001,
          message: { mid: "m_unique", text: "sabores" },
        }],
      }],
    });
    expect(events).toEqual([expect.objectContaining({
      accountId: "17890000000000000",
      externalEventId: "m_unique",
      eventType: "message",
    })]);
  });

  it("ignores payloads from another Meta product", async () => {
    await expect(extractInstagramEvents({ object: "whatsapp_business_account", entry: [] }))
      .resolves.toEqual([]);
  });
});
