import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const zeroAmountFix = readFileSync(
  new URL("../supabase/migrations/20261023120000_fix_zero_amount_cash_movement_on_free_sale.sql", import.meta.url),
  "utf8",
);
const ambiguousVarFix = readFileSync(
  new URL("../supabase/migrations/20261023120100_fix_ambiguous_flavor_id_variable_reference.sql", import.meta.url),
  "utf8",
);

describe("correcao: baixa manual/digital de fidelidade sempre dava erro no caixa", () => {
  it("so grava cash_movements quando o valor final da venda e maior que zero", () => {
    expect(zeroAmountFix).toContain("if v_final_total > 0 then");
    expect(zeroAmountFix).toContain("CHECK (amount > 0)");
  });

  it("nao qualifica variavel local plpgsql com o nome da funcao (sintaxe invalida)", () => {
    expect(ambiguousVarFix).toContain("target_flavor_id uuid;");
    expect(ambiguousVarFix).toContain("target_unit_number integer;");
    expect(ambiguousVarFix).toContain("item.flavor_id=target_flavor_id");
    expect(ambiguousVarFix).toContain("unit_number=target_unit_number");
  });
});
