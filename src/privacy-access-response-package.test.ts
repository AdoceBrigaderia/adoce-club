import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260727170000_privacy_access_response_package.sql",
    import.meta.url,
  ),
  "utf8",
);
const policy = readFileSync(
  new URL("../netlify/functions/_shared/bff-rpc-policy.ts", import.meta.url),
  "utf8",
);

describe("pacote auditado para consulta de dados", () => {
  it("mantém a migration transacional e os campos restritos à privacidade", () => {
    expect(migration.trimStart()).toMatch(/^begin;/);
    expect(migration.trimEnd()).toMatch(/commit;$/);
    expect(migration).toContain("privacy_response_prepared_at");
    expect(migration).toContain("privacy_response_delivered_at");
    expect(migration).toContain("site_feedback_privacy_response_check");
    expect(migration).toContain("category <> 'privacy'");
    expect(migration).toContain("privacy_response_delivery_channel is null");
  });

  it("exige identidade confirmada, vínculo do cadastro e trava a solicitação", () => {
    expect(migration).toContain("private.staff_has_any_capability('manage_customers')");
    expect(migration).toContain("request_row.privacy_request_type <> 'access'");
    expect(migration).toContain(
      "coalesce(request_row.privacy_identity_status, 'pending') <> 'verified'",
    );
    expect(migration).toContain("request_row.profile_id is null");
    expect(migration).toContain("for update");
  });

  it("não inclui notas internas e limita históricos extensos", () => {
    expect(migration).not.toContain("customer_crm_notes");
    expect(migration).not.toContain("customer_crm_tags");
    expect(migration).not.toContain("privacy_identity_notes',");
    expect(migration).toContain("limit 100");
    expect(migration).toContain(
      "Anotações internas, controles antifraude, segredos técnicos e dados de terceiros não integram este pacote.",
    );
  });

  it("audita somente metadados e contagens na preparação", () => {
    expect(migration).toContain("'privacy_request.access_package_prepared'");
    expect(migration).toContain("'movement_count', movement_count");
    expect(migration).toContain("'order_count', order_count");
    expect(migration).toContain("'checkin_count', checkin_count");
    expect(migration).not.toContain("'package', package");
  });

  it("exige pacote preparado antes da entrega e resolve de forma auditada", () => {
    expect(migration).toContain("request_row.privacy_response_prepared_at is null");
    expect(migration).toContain("privacy_response_delivery_channel = normalized_channel");
    expect(migration).toContain("'privacy_request.response_delivered'");
    expect(migration).toContain("status = 'resolved'");
  });

  it("expõe os dois RPCs somente pela allowlist da operação", () => {
    expect(policy).toContain('"staff_prepare_privacy_access_response"');
    expect(policy).toContain('"staff_mark_privacy_response_delivered"');
    expect(migration).toContain(
      "revoke all on function public.staff_prepare_privacy_access_response(uuid)",
    );
    expect(migration).toContain(
      "revoke all on function public.staff_mark_privacy_response_delivered(uuid,text,text)",
    );
    expect(migration).toContain("from public, anon");
    expect(migration).toContain("to authenticated");
  });
});
