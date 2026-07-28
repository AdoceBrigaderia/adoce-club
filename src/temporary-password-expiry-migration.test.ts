import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260726160015_temporary_password_expiry.sql",
    import.meta.url,
  ),
  "utf8",
);
const resetFunction = readFileSync(
  new URL("../netlify/functions/admin-reset-user-password.ts", import.meta.url),
  "utf8",
);
const bffLogin = readFileSync(
  new URL("../netlify/functions/auth-bff-login.ts", import.meta.url),
  "utf8",
);

describe("credenciais temporárias com expiração", () => {
  it("adiciona emissão, expiração, índices e restrições", () => {
    expect(migration).toContain("temporary_password_issued_at timestamptz");
    expect(migration).toContain("temporary_password_expires_at timestamptz");
    expect(migration).toContain("interval '2 hours'");
    expect(migration).toContain("profiles_temporary_password_window_check");
    expect(migration).toContain("staff_members_temporary_password_window_check");
    expect(migration).toContain("profiles_temporary_password_expires_idx");
    expect(migration).toContain("staff_members_temporary_password_expires_idx");
  });

  it("limpa a janela depois da troca obrigatória", () => {
    expect(migration).toContain(
      "create or replace function public.complete_forced_password_change()",
    );
    expect(migration).toContain("temporary_password_issued_at = null");
    expect(migration).toContain("temporary_password_expires_at = null");
    expect(migration).toContain(
      "security.forced_password_change_completed",
    );
    expect(migration).toContain(
      "grant execute on function public.complete_forced_password_change() to authenticated",
    );
  });

  it("o reset emite uma senha aleatória com validade de duas horas", () => {
    expect(resetFunction).toContain("generateTemporaryPassword()");
    expect(resetFunction).toContain("2 * 60 * 60 * 1000");
    expect(resetFunction).toContain("temporary_password_issued_at: issuedAt");
    expect(resetFunction).toContain(
      "temporary_password_expires_at: temporaryPasswordExpiresAt",
    );
    expect(resetFunction).toContain("temporary_password_ttl_minutes: 120");
  });

  it("bloqueia e revoga tentativas com senha temporária vencida", () => {
    expect(bffLogin).toContain("temporary_password_expires_at");
    expect(bffLogin).toContain("temporary_password_expired");
    expect(bffLogin).toContain("logout?scope=global");
    expect(bffLogin).toContain("Date.parse(expiresAt) <= Date.now()");
  });
});
