import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260726185348_whatsapp_cloud_otp.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("OTP automático pela Meta Cloud API", () => {
  it("armazena somente hash do código e protege a tabela com RLS", () => {
    expect(migration).toContain("code_hash text not null");
    expect(migration).not.toContain("verification_code text");
    expect(migration).toContain(
      "alter table public.whatsapp_auth_challenges enable row level security",
    );
    expect(migration).toContain(
      "revoke all on public.whatsapp_auth_challenges from public, anon, authenticated",
    );
  });

  it("limita solicitações por número e origem", () => {
    expect(migration).toContain("challenge.phone_hash = normalized_phone_hash");
    expect(migration).toContain("challenge.request_ip_hash = requested_ip_hash");
    expect(migration).toContain("interval '15 minutes'");
    expect(migration).toContain(") >= 5 then");
    expect(migration).toContain(") >= 30 then");
  });

  it("bloqueia a linha durante a verificação e limita tentativas", () => {
    expect(migration).toContain("for update");
    expect(migration).toContain("challenge.attempts >= challenge.max_attempts");
    expect(migration).toContain("status = 'blocked'");
    expect(migration).toContain("status = 'verified'");
  });

  it("mantém idempotência e rastreia entrega da Meta", () => {
    expect(migration).toContain("idempotency_key text not null unique");
    expect(migration).toContain("provider_message_id text unique");
    expect(migration).toContain("server_update_whatsapp_auth_delivery");
    expect(migration).toContain("delivered_at");
    expect(migration).toContain("read_at");
    expect(migration).toContain("failed_at");
  });

  it("expõe as rotinas somente ao service_role", () => {
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
  });
});
