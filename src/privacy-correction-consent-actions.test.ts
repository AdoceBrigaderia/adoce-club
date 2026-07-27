import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260727173000_privacy_correction_consent_actions.sql",
    import.meta.url,
  ),
  "utf8",
);
const listMigration = readFileSync(
  new URL(
    "../supabase/migrations/20260727174000_privacy_action_status_list.sql",
    import.meta.url,
  ),
  "utf8",
);
const policy = readFileSync(
  new URL("../netlify/functions/_shared/bff-rpc-policy.ts", import.meta.url),
  "utf8",
);

describe("ações auditadas de correção e consentimento", () => {
  it("mantém campos de execução restritos às solicitações de privacidade", () => {
    expect(migration.trimStart()).toMatch(/^begin;/);
    expect(migration.trimEnd()).toMatch(/commit;$/);
    expect(migration).toContain("privacy_action_applied_at");
    expect(migration).toContain("privacy_action_applied_by");
    expect(migration).toContain("privacy_action_type");
    expect(migration).toContain("site_feedback_privacy_action_check");
    expect(migration).toContain("category <> 'privacy'");
  });

  it("corrige somente nome normalizado após identidade e vínculo confirmados", () => {
    expect(migration).toContain("private.normalize_person_name(requested_full_name)");
    expect(migration).toContain("request_row.privacy_request_type <> 'correction'");
    expect(migration).toContain(
      "coalesce(request_row.privacy_identity_status, 'pending') <> 'verified'",
    );
    expect(migration).toContain("request_row.profile_id is null");
    expect(migration).toContain("for update");
    expect(migration).toContain("'privacy_request.profile_name_corrected'");
    expect(migration).toContain("status = 'resolved'");
  });

  it("revoga canais promocionais quando marketing não está autorizado", () => {
    expect(migration).toContain(
      "allow_whatsapp boolean := coalesce(requested_marketing, false) and coalesce(requested_whatsapp, false)",
    );
    expect(migration).toContain(
      "allow_email boolean := coalesce(requested_marketing, false) and coalesce(requested_email, false)",
    );
    expect(migration).toContain("'marketing'");
    expect(migration).toContain("'privacy_request_staff'");
    expect(migration).toContain("'privacy_request.marketing_consent_changed'");
    expect(migration).toContain("whatsapp_enabled = excluded.whatsapp_enabled");
    expect(migration).toContain("email_enabled = excluded.email_enabled");
  });

  it("carrega na fila o estado da ação aplicada", () => {
    expect(listMigration).toContain("privacy_action_applied_at");
    expect(listMigration).toContain("privacy_action_type");
    expect(listMigration).toContain("privacy_action_summary");
  });

  it("expõe os RPCs somente na allowlist do BFF e não ao anônimo", () => {
    expect(policy).toContain('"staff_apply_privacy_name_correction"');
    expect(policy).toContain('"staff_apply_privacy_consent_change"');
    expect(migration).toContain(
      "revoke all on function public.staff_apply_privacy_name_correction(uuid,text)",
    );
    expect(migration).toContain(
      "revoke all on function public.staff_apply_privacy_consent_change(uuid,boolean,boolean,boolean)",
    );
    expect(migration).toContain("from public, anon");
    expect(migration).toContain("to authenticated");
  });
});
