import { describe, expect, it } from "vitest";
import { productionApiOrigin, resolveApiRequestUrl } from "./lib/native-api";

describe("endereços de API no aplicativo Android", () => {
  it("envia chamadas /api para o servidor oficial no Android", () => {
    expect(resolveApiRequestUrl("/api/staff-phone-login", true)).toBe(
      `${productionApiOrigin}/api/staff-phone-login`,
    );
  });

  it("preserva os endereços relativos no site", () => {
    expect(resolveApiRequestUrl("/api/staff-phone-login", false)).toBe(
      "/api/staff-phone-login",
    );
  });

  it("não altera chamadas diretas ao Supabase", () => {
    const supabaseUrl = "https://uefwywizqhfvvijaopcn.supabase.co/auth/v1/token";
    expect(resolveApiRequestUrl(supabaseUrl, true)).toBe(supabaseUrl);
  });
});
