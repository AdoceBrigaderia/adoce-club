import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const app = readFileSync("src/AccessApp.tsx", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260813231628_restore_staff_purchase_grant.sql",
  "utf8",
);

describe("lançamento de carimbos pela equipe", () => {
  it("mantém a tela ligada à RPC protegida de compra", () => {
    expect(app).toContain('"staff_record_purchase"');
    expect(app).toContain("idempotency_key: crypto.randomUUID()");
  });

  it("libera somente a equipe autenticada e preserva anon bloqueado", () => {
    expect(migration).toContain(
      "grant execute on function public.staff_record_purchase(uuid, uuid, smallint, text, text)",
    );
    expect(migration).toContain("to authenticated");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("has_function_privilege('anon'");
  });
});
