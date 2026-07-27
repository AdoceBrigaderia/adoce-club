import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const panel = readFileSync(
  new URL("./OperationPrivacyAnonymization.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("./operation-privacy-anonymization.css", import.meta.url),
  "utf8",
);
const hub = readFileSync(
  new URL("./OperationBusinessHub.tsx", import.meta.url),
  "utf8",
);
const policy = readFileSync(
  new URL("../netlify/functions/_shared/bff-rpc-policy.ts", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260727180000_privacy_profile_anonymization.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("operação protegida de anonimização", () => {
  it("fica oculta para quem não é proprietário", () => {
    expect(panel).toContain('session.user.role === "owner"');
    expect(panel).toContain("if (owner === false) return null");
    expect(migration).toContain("private.current_staff_role()::text <> 'owner'");
  });

  it("revisa todos os bloqueios e impactos antes de executar", () => {
    expect(panel).toContain('"staff_get_privacy_anonymization_plan"');
    expect(panel).toContain("open_orders");
    expect(panel).toContain("open_service_requests");
    expect(panel).toContain("shared_loyalty_accounts");
    expect(panel).toContain("loyalty_accounts");
    expect(panel).toContain("orders_to_anonymize");
    expect(panel).toContain("service_requests_to_anonymize");
    expect(panel).toContain("available_rewards_to_reverse");
    expect(panel).toContain("checkins_to_remove");
  });

  it("bloqueia revisão sem identidade e exige plano recente", () => {
    expect(panel).toContain('item.privacy_identity_status !== "verified"');
    expect(panel).toContain("attachPrivacyReviewWindow(plan)");
    expect(panel).toContain("privacyReviewIsFresh(plan)");
    expect(panel).toContain("a revisão expirou");
    expect(panel).toContain("disabled={busy || !identityVerified}");
  });

  it("usa a confirmação devolvida pelo backend e aceite explícito", () => {
    expect(panel).toContain(
      "confirmations[item.id] !== plan.confirmation_required",
    );
    expect(panel).toContain("!acknowledged[item.id]");
    expect(panel).toContain("Esta ação é irreversível");
    expect(panel).toContain("plan.confirmation_required");
    expect(panel).toContain(
      "Revisei os bloqueios, o impacto e confirmei o titular correto",
    );
  });

  it("mantém confirmação acessível e adequada ao toque", () => {
    expect(panel).toContain("htmlFor={confirmationId}");
    expect(panel).toContain("aria-describedby={confirmationHelpId}");
    expect(panel).toContain('autoCapitalize="characters"');
    expect(panel).toContain("spellCheck={false}");
    expect(styles).toContain("min-height:46px");
    expect(styles).toContain("min-height:48px");
    expect(styles).toContain("input[type=checkbox]{width:1.25rem");
    expect(styles).toContain(":focus-visible");
  });

  it("executa somente pelo BFF e atualiza a fila", () => {
    expect(panel).toContain('"staff_anonymize_privacy_profile"');
    expect(panel).toContain("requested_confirmation: confirmations[item.id]");
    expect(panel).toContain("await load()");
    expect(panel).not.toContain("supabase.rpc");
    expect(policy).toContain('"staff_get_privacy_anonymization_plan"');
    expect(policy).toContain('"staff_anonymize_privacy_profile"');
  });

  it("está integrado à central real da operação", () => {
    expect(hub).toContain(
      'import OperationPrivacyAnonymization from "./OperationPrivacyAnonymization"',
    );
    expect(hub).toContain("<OperationPrivacyAnonymization />");
  });
});
