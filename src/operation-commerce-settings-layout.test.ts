import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("./operation-commerce-tools.css", import.meta.url), "utf8");

describe("layout das configurações comerciais", () => {
  it("mantém os campos de taxas dentro do cartão em qualquer largura", () => {
    expect(styles).toContain("grid-template-columns:minmax(0,1fr) minmax(96px,120px) minmax(96px,120px)");
    expect(styles).toContain(".payment-method-settings article input{box-sizing:border-box;width:100%;min-width:0;max-width:100%}");
    expect(styles).toContain("@media(max-width:1050px){.commerce-settings-grid,.commerce-report-grid{grid-template-columns:1fr}}");
    expect(styles).toContain("@media(max-width:430px){.payment-method-settings article{grid-template-columns:1fr}");
  });
});
