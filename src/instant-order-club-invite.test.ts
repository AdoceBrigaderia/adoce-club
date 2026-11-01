import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const panel = readFileSync(new URL("./InstantOrderPanel.tsx", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260723012027_link_instant_order_by_phone_and_offer_club.sql", import.meta.url), "utf8");

describe("aviso informativo do Clube depois do pedido", () => {
  it("avisa quando o pedido aceito não encontrou cadastro -- cadastro agora é automático, não opcional", () => {
    expect(panel).toContain("Boolean(response.offer_club_invite)");
    expect(panel).toContain("Boas-vindas ao Clube Adoce!");
    expect(panel).toContain("Seu cadastro é automático e os carimbos aparecem após a confirmação do pagamento.");
    expect(panel).toContain("seu pedido já foi recebido normalmente");
  });

  it("não redireciona mais para cadastro manual -- a inscrição é automática na confirmação do pagamento", () => {
    expect(panel).not.toContain('sessionStorage.setItem("adoce-club-order-invite"');
    expect(panel).not.toContain('window.location.href = "/cadastro"');
  });

  it("associa por celular no servidor sem devolver dados do membro", () => {
    expect(migration).toContain("create or replace function public.submit_instant_order_v4");
    expect(migration).toContain("set profile_id = linked_profile_id");
    expect(migration).toContain("'offer_club_invite', linked_profile_id is null");
    expect(migration).not.toContain("full_name");
    expect(migration).not.toContain("member_code");
  });
});
