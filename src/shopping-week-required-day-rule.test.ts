import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { canMarkFlavorOnDay } from "./ShoppingWeekTable";
import { emptyShoppingWeek } from "./lib/shopping-week";

const migration = readFileSync(
  new URL("../supabase/migrations/20261022150000_required_day_rule_for_daily_flavor.sql", import.meta.url),
  "utf8",
);

describe("regra: so marcar sabor em dia obrigatorio a partir de 26/10/2026", () => {
  it("bloqueia marcar sabor em dia nao obrigatorio a partir da data da regra", () => {
    const plan = emptyShoppingWeek();
    expect(canMarkFlavorOnDay("2026-10-26", plan)).toBe(false);
    expect(canMarkFlavorOnDay("2026-11-02", plan)).toBe(false);
  });

  it("permite marcar sabor quando o dia ja esta marcado como obrigatorio", () => {
    const plan = { ...emptyShoppingWeek(), requiredDays: { "2026-10-26": true } };
    expect(canMarkFlavorOnDay("2026-10-26", plan)).toBe(true);
    expect(canMarkFlavorOnDay("2026-10-27", plan)).toBe(false);
  });

  it("nao restringe planejamentos de dias anteriores a 26/10/2026", () => {
    const plan = emptyShoppingWeek();
    expect(canMarkFlavorOnDay("2026-10-25", plan)).toBe(true);
    expect(canMarkFlavorOnDay("2026-01-01", plan)).toBe(true);
  });

  it("tambem valida a regra no servidor, nao so na interface", () => {
    expect(migration).toContain("requested_group='daily' and amount>0 and day_date>=date '2026-10-26'");
    expect(migration).toContain("coalesce((saved->'requiredDays'->>day_date::text)::boolean,false) is distinct from true");
    expect(migration).toContain("dia obrigatório antes de escolher sabores");
  });
});
