import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260719040443_club_groups_whatsapp_and_whole_cakes.sql",
    import.meta.url,
  ),
  "utf8",
);
const webhook = readFileSync(
  new URL("../netlify/functions/meta-whatsapp-webhook.ts", import.meta.url),
  "utf8",
);
const access = readFileSync(new URL("./AccessApp.tsx", import.meta.url), "utf8");
const admin = readFileSync(
  new URL("./OperationContentAdmin.tsx", import.meta.url),
  "utf8",
);
const today = readFileSync(new URL("./AdoceHoje.tsx", import.meta.url), "utf8");

describe("confirmação antifraude pelo WhatsApp da Meta", () => {
  it("mantém o segredo no servidor e valida a assinatura do webhook", () => {
    expect(webhook).toContain('env("META_WHATSAPP_APP_SECRET")');
    expect(webhook).toContain('request.headers.get("x-hub-signature-256")');
    expect(webhook).toContain('env("SUPABASE_SECRET_KEY")');
    expect(webhook).not.toContain("VITE_META_WHATSAPP_APP_SECRET");
  });

  it("exige telefone único, código temporário e bloqueia indicação no mesmo grupo", () => {
    expect(migration).toContain("whatsapp_one_open_challenge");
    expect(migration).toContain("interval '15 minutes'");
    expect(migration).toContain("whatsapp.duplicate_phone_blocked");
    expect(migration).toContain("Membros do mesmo cartão em grupo não geram indicação");
    expect(access).toContain("Confirmar meu WhatsApp");
  });
});

describe("Cartão Clube Adoce em grupo", () => {
  it("limita a 5, preserva o saldo compartilhado e mantém identidade individual", () => {
    expect(migration).toContain("member_count >= 5");
    expect(migration).toContain("group.account_merged");
    expect(migration).toContain("update public.ledger_entries set track_id");
    expect(migration).toContain("'member_code', p.member_code");
    expect(access).toContain("Cada pessoa mantém seu próprio acesso, Código do Membro e QR");
  });
});

describe("catálogo administrável e ordenado", () => {
  it("usa foto e preço próprios para a torta G sem preço fixo no cliente", () => {
    expect(admin).toContain("whole_cake_price");
    expect(admin).toContain('"whole_cake"');
    expect(today).toContain("flavor.wholeCakePrice");
    expect(today).not.toContain("pessoas por R$ 195,00");
    expect(today).not.toContain("fallbackWholeCakes");
    expect(migration).not.toContain("whole_cake_price = 195");
  });

  it("ordena produtos e membros alfabeticamente em português", () => {
    expect(admin).toContain('localeCompare(b.name, "pt-BR"');
    expect(access).toContain('.order("full_name", { ascending: true })');
    expect(access).toContain('localeCompare(b.full_name, "pt-BR"');
  });
});
