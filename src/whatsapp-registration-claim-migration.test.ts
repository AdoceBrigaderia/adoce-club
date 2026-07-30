import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260726194558_claim_whatsapp_registration.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("vinculação do WhatsApp verificado ao cadastro", () => {
  it("exige sessão autenticada e desafio de cadastro verificado", () => {
    expect(migration).toContain("auth.uid()");
    expect(migration).toContain("challenge.status <> 'verified'");
    expect(migration).toContain("challenge.purpose <> 'registration'");
  });

  it("bloqueia reutilização e telefone vinculado a outra conta", () => {
    expect(migration).toContain(
      "challenge.profile_id is not null and challenge.profile_id <> current_profile_id",
    );
    expect(migration).toContain("profile.phone_e164 = challenge.phone_e164");
    expect(migration).toContain("Este WhatsApp ja esta vinculado a outro cadastro");
  });

  it("usa bloqueio transacional e registra auditoria", () => {
    expect(migration).toContain("for update");
    expect(migration).toContain("security.whatsapp_registration_claimed");
    expect(migration).toContain("insert into public.audit_events");
  });

  it("não concede execução pública ou anônima", () => {
    expect(migration).toContain("from public, anon");
    expect(migration).toContain("to authenticated");
  });
});
