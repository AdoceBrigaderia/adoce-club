import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260726175003_manual_loyalty_adjustment.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("ajuste manual de fidelidade", () => {
  it("exige capacidade específica e idempotência", () => {
    expect(migration).toContain("staff_has_any_capability('manage_loyalty')");
    expect(migration).toContain("idempotency_key = operation_key");
    expect(migration).toContain("char_length(operation_key) < 12");
  });

  it("usa bloqueio transacional e avanço oficial para inclusões", () => {
    expect(migration).toContain("for update");
    expect(migration).toContain("private.advance_track(");
    expect(migration).toContain("'manual_adjustment'::public.ledger_reason");
  });

  it("protege prêmios já resgatados durante remoções", () => {
    expect(migration).toContain("reward.status = 'redeemed'");
    expect(migration).toContain("set status = 'reversed'");
    expect(migration).toContain("Os premios vinculados nao permitem");
  });

  it("registra extrato, auditoria e evento de integração", () => {
    expect(migration).toContain("insert into public.ledger_entries");
    expect(migration).toContain("insert into public.audit_events");
    expect(migration).toContain("insert into public.outbox_events");
    expect(migration).toContain("loyalty.manual_adjustment");
  });

  it("remove acesso público e anônimo", () => {
    expect(migration).toContain(
      "revoke all on function public.staff_adjust_loyalty_stamps(uuid,uuid,smallint,text,text) from public, anon",
    );
    expect(migration).toContain(
      "grant execute on function public.staff_adjust_loyalty_stamps(uuid,uuid,smallint,text,text) to authenticated",
    );
  });
});
