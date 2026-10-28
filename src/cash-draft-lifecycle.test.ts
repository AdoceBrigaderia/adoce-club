import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const migration = readFileSync(
  new URL("../supabase/migrations/20261016142700_cash_draft_cleanup_and_lot_continuity.sql", import.meta.url),
  "utf8",
);
const strictPreviousDay = readFileSync(
  new URL("../supabase/migrations/20261016144515_strict_previous_day_inventory_continuity.sql", import.meta.url),
  "utf8",
);
const beforeOperation = readFileSync(
  new URL("../supabase/migrations/20261016144811_reconcile_previous_day_balance_before_operation.sql", import.meta.url),
  "utf8",
);

describe("ciclo de vida do rascunho e continuidade por lote", () => {
  it("libera somente outros carrinhos com autorização, recálculo e auditoria",()=>{
    const directory=join(process.cwd(),"supabase","migrations");
    const releaseMigration=readdirSync(directory).find(name=>name.endsWith("release_other_cash_drafts.sql"));
    expect(releaseMigration).toBeTruthy();
    const sql=readFileSync(join(directory,releaseMigration!),"utf8");
    expect(sql).toContain("staff_release_other_cash_drafts");
    expect(sql).toContain("draft_key <> preserved_draft_key");
    expect(sql).toContain("private.can_access_store");
    expect(sql).toContain("private.recalcular_reserva_de_fatias");
    expect(sql).toContain("cash_draft.released_by_staff");
  });
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

  it("usa exclusivamente o saldo da data de ontem", () => {
    expect(strictPreviousDay).toContain("previous.service_date=target_date-1");
    expect(strictPreviousDay).toContain("b.service_date=target_date-1");
    expect(strictPreviousDay).not.toContain("previous.service_date<target_date");
  });

  it("reconcilia movimentos feitos antes da continuidade e executa antes da operação", () => {
    expect(beforeOperation).toContain("batch.service_date = target_date - 1");
    expect(beforeOperation).toContain("item.status = 'paid'");
    expect(beforeOperation).toContain("customer_order.status = 'completed'");
    expect(beforeOperation).toContain("loss.service_date = target_date");
    expect(beforeOperation).toContain("'5 3 * * *'");
    expect(beforeOperation).not.toContain("batch.service_date < target_date");
  });

  it("reaproveita o lote automático sem duplicar a quantidade física", () => {
    expect(beforeOperation).toContain("capture_unbatched_inventory_increase");
    expect(beforeOperation).toContain("available_from = time '00:00'");
    expect(beforeOperation).toContain("set available_from = time '08:00'");
    expect(beforeOperation).not.toContain("insert into public.flavor_availability_batches(");
  });
});
