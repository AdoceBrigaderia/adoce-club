import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const panel = readFileSync(new URL("./InstantOrderPanel.tsx", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260723012027_link_instant_order_by_phone_and_offer_club.sql", import.meta.url), "utf8");

describe("convite opcional ao Clube depois do pedido", () => {
  it("só oferece o Clube quando o pedido aceito não encontrou cadastro", () => {
    expect(panel).toContain("Boolean(response.offer_club_invite)");
    expect(panel).toContain("Você já conhece o Clube Adoce?");
    expect(panel).toContain("Quero fazer parte");
    expect(panel).toContain("Agora não");
    expect(panel).toContain("seu pedido já foi recebido normalmente");
  });

  it("leva nome e celular para o cadastro sem cadastrar por conta própria", () => {
    expect(panel).toContain("adoce-club-order-invite");
    expect(panel).toContain('window.location.href = "/#cadastro"');
  });

  it("associa por celular no servidor sem devolver dados do membro", () => {
    expect(migration).toContain("create or replace function public.submit_instant_order_v4");
    expect(migration).toContain("set profile_id = linked_profile_id");
    expect(migration).toContain("'offer_club_invite', linked_profile_id is null");
    expect(migration).not.toContain("full_name");
    expect(migration).not.toContain("member_code");
  });
});
