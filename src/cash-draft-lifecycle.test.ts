import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20261016142700_cash_draft_cleanup_and_lot_continuity.sql", import.meta.url),
  "utf8",
);

describe("ciclo de vida do rascunho e continuidade por lote", () => {
  it("libera reservas expiradas periodicamente e recalcula o saldo", () => {
    expect(migration).toContain("expire_cash_draft_reservations");
    expect(migration).toContain("private.recalcular_reserva_de_fatias");
    expect(migration).toContain("adoce-expire-cash-draft-reservations");
  });

  it("transporta lotes remanescentes para 08h sem duplicar estoque", () => {
    expect(migration).toContain("carry_forward_flavor_inventory_batches");
    expect(migration).toContain("time '08:00'");
    expect(migration).toContain("source_batch_id");
    expect(migration).toContain("unique (source_batch_id, target_service_date)");
  });
});
