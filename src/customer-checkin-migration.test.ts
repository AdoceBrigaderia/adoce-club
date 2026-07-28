import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260726191325_customer_nfc_qr_checkins.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("check-in efêmero por NFC e QR", () => {
  it("expira rapidamente e mantém somente um check-in ativo por cliente e loja", () => {
    expect(migration).toContain("now() + interval '2 minutes'");
    expect(migration).toContain("customer_checkins_one_waiting_profile_store");
    expect(migration).toContain("set status = 'expired'");
  });

  it("resolve o cartão do cliente no backend e não expõe identificador no NFC", () => {
    expect(migration).toContain("from public.account_memberships membership");
    expect(migration).toContain("track.kind = 'main'");
    expect(migration).toContain("'source', 'nfc_qr_store_tag'");
  });

  it("protege o atendimento com acesso à loja e bloqueio transacional", () => {
    expect(migration).toContain("private.can_access_store(checkin.store_id)");
    expect(migration).toContain("for update");
    expect(migration).toContain("private.staff_has_any_capability('manage_loyalty')");
  });

  it("aplica carimbos e encerra o check-in na mesma transação", () => {
    expect(migration).toContain("public.staff_adjust_loyalty_stamps(");
    expect(migration).toContain("set status = 'claimed'");
    expect(migration).toContain("claim_operation_key = operation_key");
    expect(migration).toContain("claim_result = final_result");
  });

  it("remove acesso direto às tabelas e libera apenas funções autenticadas", () => {
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("revoke all on table public.customer_checkins from public, anon, authenticated");
    expect(migration).toContain("grant execute on function public.customer_create_store_checkin(text,text,text) to authenticated");
  });
});
