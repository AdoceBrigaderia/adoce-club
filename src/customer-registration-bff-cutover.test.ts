import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const page = readFileSync(
  new URL("./CustomerRegistrationBffPage.tsx", import.meta.url),
  "utf8",
);
const auth = readFileSync(
  new URL("./services/bff-auth.ts", import.meta.url),
  "utf8",
);
const whatsapp = readFileSync(
  new URL("./services/whatsapp-otp-bff.ts", import.meta.url),
  "utf8",
);

const requestFunction = readFileSync(
  new URL(
    "../netlify/functions/auth-bff-registration-request.ts",
    import.meta.url,
  ),
  "utf8",
);
const completeFunction = readFileSync(
  new URL(
    "../netlify/functions/auth-bff-registration-complete.ts",
    import.meta.url,
  ),
  "utf8",
);

describe("corte BFF do cadastro público", () => {
  it("roteia o cadastro real para o componente sem Supabase no navegador", () => {
    expect(app).toContain('import("./CustomerRegistrationBffPage")');
    expect(page).not.toContain("requireSupabase");
    expect(page).not.toContain("services/auth");
    expect(page).not.toContain("auth.setSession");
    expect(page).not.toContain("Authorization");
  });

  it("solicita e conclui o cadastro somente pelas funções BFF", () => {
    expect(page).toContain("bffRequestRegistrationEmailCode");
    expect(page).toContain("bffCompleteRegistration");
    expect(auth).toContain('"/api/auth-bff-registration-request"');
    expect(auth).toContain('"/api/auth-bff-registration-complete"');
    expect(auth).toContain('credentials: "same-origin"');
  });

  it("mantém o OTP do WhatsApp isolado do cliente Supabase", () => {
    expect(whatsapp).toContain('"/api/whatsapp-otp-request"');
    expect(whatsapp).toContain('"/api/whatsapp-otp-verify"');
    expect(whatsapp).not.toContain("requireSupabase");
    expect(whatsapp).not.toContain("@supabase/supabase-js");
  });

  it("emite cookies HttpOnly apenas no servidor depois do OTP de e-mail", () => {
    expect(requestFunction).toContain("signInWithOtp");
    expect(requestFunction).toContain("persistSession: false");
    expect(completeFunction).toContain("verifyOtp");
    expect(completeFunction).toContain("sessionCookies(");
    expect(completeFunction).toContain('"client"');
    expect(completeFunction).not.toContain("access_token:");
    expect(completeFunction).not.toContain("refresh_token:");
  });
});
