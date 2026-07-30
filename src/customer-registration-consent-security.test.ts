import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import registrationComplete from "../netlify/functions/auth-bff-registration-complete";

const endpoint = readFileSync(
  new URL(
    "../netlify/functions/auth-bff-registration-complete.ts",
    import.meta.url,
  ),
  "utf8",
);
const page = readFileSync(
  new URL("./CustomerRegistrationBffPage.tsx", import.meta.url),
  "utf8",
);
const service = readFileSync(
  new URL("./services/bff-auth.ts", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260728170236_harden_customer_registration_consent.sql",
    import.meta.url,
  ),
  "utf8",
);

function completionRequest(legalAccepted?: boolean) {
  return new Request(
    "http://localhost:5173/api/auth-bff-registration-complete",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:5173",
      },
      body: JSON.stringify({
        email: "cliente@example.com",
        token: "123456",
        fullName: "Cliente Seguro",
        phone: "+5585988887777",
        legalAccepted,
        marketingAccepted: true,
      }),
    },
  );
}

describe("consentimento seguro no cadastro BFF", () => {
  it.each([undefined, false])(
    "recusa o cadastro antes do OTP quando o aceite legal for %s",
    async (legalAccepted) => {
      const response = await registrationComplete(
        completionRequest(legalAccepted),
      );
      const payload = (await response.json()) as { error?: string };

      expect(response.status).toBe(400);
      expect(payload.error).toContain("Termos do Clube");
      expect(payload.error).toContain("Política de Privacidade");
    },
  );

  it("transporta o aceite explícito da interface até a RPC", () => {
    expect(page).toContain("legalAccepted,");
    expect(service).toContain("legalAccepted: boolean");
    expect(endpoint).toContain("body.legalAccepted !== true");
    expect(endpoint).toContain("next_legal_accepted: true");
  });

  it("remove a assinatura vulnerável e exige o aceite dentro do banco", () => {
    expect(migration).toContain(
      "drop function if exists public.customer_complete_registration(",
    );
    expect(migration).toContain("text,text,boolean,uuid,text");
    expect(migration).toContain("next_legal_accepted boolean");
    expect(migration).toContain(
      "if next_legal_accepted is distinct from true then",
    );
  });

  it("fixa as versões documentais no backend", () => {
    expect(migration).toContain(
      "terms_document_version constant text := '1.0'",
    );
    expect(migration).toContain(
      "privacy_document_version constant text := '1.0'",
    );
    expect(migration).toContain(
      "marketing_document_version constant text := '1.0'",
    );
    expect(migration).not.toContain("next_terms_document_version");
    expect(migration).not.toContain("next_privacy_document_version");
  });

  it("não ativa telefone ou marketing sem WhatsApp verificado", () => {
    expect(migration).toContain(
      "public.customer_claim_verified_whatsapp_registration(",
    );
    expect(migration).toContain(
      "and coalesce(profile_record.phone_e164 = normalized_phone, false)",
    );
    expect(migration).toMatch(
      /effective_marketing :=\s+coalesce\(next_marketing, false\)\s+and whatsapp_verified/,
    );
    expect(migration).toContain("whatsapp_enabled = excluded.whatsapp_enabled");
    expect(migration).not.toContain(
      "when target_whatsapp_challenge_id is null then normalized_phone",
    );
  });
});
