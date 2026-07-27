import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260727150000_privacy_request_operation.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("gestão operacional das solicitações de privacidade", () => {
  it("exige autenticação e capacidade de clientes", () => {
    expect(migration).toContain("staff_list_privacy_requests");
    expect(migration).toContain("staff_update_privacy_request");
    expect(migration).toContain("private.staff_has_any_capability('manage_customers')");
    expect(migration).toContain("from public, anon");
    expect(migration).toContain("to authenticated");
  });

  it("limita a privacidade, trava a linha e audita a alteração", () => {
    expect(migration).toContain("feedback.category = 'privacy'");
    expect(migration).toContain("for update");
    expect(migration).toContain("'privacy_request.updated'");
    expect(migration).toContain("'previous_status'");
    expect(migration).toContain("'next_status'");
    expect(migration).toContain("'notes_changed'");
    expect(migration).not.toContain("'customer_email'");
    expect(migration).not.toContain("'customer_phone'");
  });

  it("cria índice parcial e mantém a alteração transacional", () => {
    expect(migration).toContain("site_feedback_privacy_status_created_idx");
    expect(migration).toContain("where category = 'privacy'");
    expect(migration.trimStart()).toMatch(/^begin;/);
    expect(migration.trimEnd()).toMatch(/commit;$/);
  });
});
