import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("apresentação móvel da entrada comercial", () => {
  const styles = readFileSync(new URL("./public-commercial-polish.css", import.meta.url), "utf8");

  it("aproxima e amplia a fatia do conteúdo no topo móvel", () => {
    expect(styles).toContain(".brand-hero-cake { min-height: 355px; margin: -22px -18px -82px; }");
    expect(styles).toContain("width: 132%");
    expect(styles).toContain("top: 4px");
    expect(styles).toContain("bottom: auto");
  });
});
