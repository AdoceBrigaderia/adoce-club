import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("seguranca do QR do cliente", () => {
  const app = readFileSync(new URL("./AccessApp.tsx", import.meta.url), "utf8");
  const migration = readFileSync(
    new URL("../supabase/migrations/20260717215732_secure_customer_qr_and_staff_scanner.sql", import.meta.url),
    "utf8",
  );

  it("armazena somente o hash e limita o QR a quinze minutos", () => {
    expect(migration).toContain("token_hash bytea");
    expect(migration).toContain("extensions.digest(raw_token, 'sha256')");
    expect(migration).toContain("interval '15 minutes'");
    const tokenTable = migration.slice(0, migration.indexOf("alter table public.customer_qr_tokens"));
    expect(tokenTable).not.toMatch(/\btoken\s+text/i);
  });

  it("exige uma pessoa da equipe para localizar o cadastro", () => {
    const lookup = migration.slice(
      migration.indexOf("create or replace function public.staff_lookup_customer_by_qr"),
      migration.indexOf("revoke all on function public.issue_customer_qr"),
    );

    expect(lookup).toContain("private.is_staff()");
    expect(lookup).toContain("raise exception 'Acesso não autorizado.'");
    expect(lookup).not.toContain("ledger_entries");
    expect(lookup).not.toContain("rewards");
  });

  it("mantem compra e resgate fora da leitura do QR", () => {
    const qrLookup = app.slice(
      app.indexOf("const lookupCustomerQr"),
      app.indexOf("const startScanner"),
    );

    expect(qrLookup).toContain("staff_lookup_customer_by_qr");
    expect(qrLookup).not.toContain("register_purchase");
    expect(qrLookup).not.toContain("redeem_reward");
  });

  it("oferece instrucoes de instalacao para Android e iPhone", () => {
    expect(app).toContain("Android · Google Chrome");
    expect(app).toContain("iPhone · Safari");
    expect(app).toContain("Adicionar à Tela de Início");
  });
});
