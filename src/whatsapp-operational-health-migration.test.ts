import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260727041000_whatsapp_operational_health.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("metricas operacionais do WhatsApp", () => {
  it("restringe o painel a proprietario ou gestor", () => {
    expect(migration).toContain("not private.is_manager()");
    expect(migration).toContain(
      "Apenas proprietarios e gestores podem consultar a integracao do WhatsApp",
    );
  });

  it("calcula entrega verificacao falhas e serie diaria no banco", () => {
    expect(migration).toContain("delivered_count");
    expect(migration).toContain("verified_count");
    expect(migration).toContain("unsuccessful_count");
    expect(migration).toContain("delivery_rate");
    expect(migration).toContain("verification_rate");
    expect(migration).toContain("daily_summary");
  });

  it("nao devolve telefone nem hashes sensiveis", () => {
    expect(migration).not.toContain("'phone_e164'");
    expect(migration).not.toContain("'phone_hash'");
    expect(migration).not.toContain("'request_ip_hash'");
    expect(migration).not.toContain("'code_hash'");
  });

  it("remove acesso publico e anonimo", () => {
    expect(migration).toContain(
      "revoke all on function public.manager_get_whatsapp_otp_metrics(smallint) from public, anon",
    );
    expect(migration).toContain(
      "grant execute on function public.manager_get_whatsapp_otp_metrics(smallint) to authenticated",
    );
  });
});
