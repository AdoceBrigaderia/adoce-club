import { describe, expect, it } from "vitest";
import { instagramEmbedUrl, normalizeInstagramUrl } from "./commercial-media";

describe("commercial media", () => {
  it("accepts only public Instagram post and reel links", () => {
    expect(normalizeInstagramUrl("https://www.instagram.com/reel/ABC_123/?utm_source=x")).toBe("https://www.instagram.com/reel/ABC_123/");
    expect(normalizeInstagramUrl("https://instagram.com/p/Post-9/")).toBe("https://www.instagram.com/p/Post-9/");
    expect(normalizeInstagramUrl("https://example.com/reel/ABC")).toBeNull();
    expect(normalizeInstagramUrl("javascript:alert(1)")).toBeNull();
  });

  it("builds the official lazy embed URL", () => {
    expect(instagramEmbedUrl("https://instagram.com/reel/ABC/"))
      .toBe("https://www.instagram.com/reel/ABC/embed/");
  });
});
