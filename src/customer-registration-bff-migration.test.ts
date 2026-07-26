import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260727024000_customer_registration_bff.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("conclusão transacional do cadastro pelo BFF", () => {
  it("usa o usuário autenticado e normaliza nome e telefone no banco", () => {
    expect(migration).toContain("auth.uid()");
    expect(migration).toContain("private.normalize_person_name");
    expect(migration).toContain("regexp_replace");
    expect(migration).toContain("+55");
  });

  it("vincula WhatsApp verificado e recusa desafio de outro número", () => {
    expect(migration).toContain("customer_claim_verified_whatsapp_registration");
    expect(migration).toContain("A validacao do WhatsApp pertence a outro numero");
  });

  it("registra consentimentos e preferências em uma única transação", () => {
    expect(migration).toContain("insert into public.consent_events");
    expect(migration).toContain("web_simplified_registration_bff");
    expect(migration).toContain("insert into public.notification_preferences");
    expect(migration).toContain("on conflict (profile_id) do update");
  });

  it("preserva indicação sem impedir o cadastro e registra auditoria", () => {
    expect(migration).toContain("perform public.accept_referral_invite");
    expect(migration).toContain("exception when others");
    expect(migration).toContain("customer.registration_completed_bff");
  });

  it("remove acesso público e anônimo", () => {
    expect(migration).toContain(
      "revoke all on function public.customer_complete_registration(text,text,boolean,uuid,text)",
    );
    expect(migration).toContain("from public, anon");
    expect(migration).toContain("to authenticated");
  });
});
