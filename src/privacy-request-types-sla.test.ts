import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260727153000_privacy_request_types_and_sla.sql",
    import.meta.url,
  ),
  "utf8",
);
const publicPage = readFileSync(
  new URL("./FeedbackPage.tsx", import.meta.url),
  "utf8",
);
const endpoint = readFileSync(
  new URL("../netlify/functions/public-feedback.ts", import.meta.url),
  "utf8",
);
const operation = readFileSync(
  new URL("./OperationPrivacyRequests.tsx", import.meta.url),
  "utf8",
);

const privacyTypes = ["access", "correction", "deletion", "consent", "other"];

describe("tipos e prazo operacional das solicitações de privacidade", () => {
  it("classifica o pedido no formulário e valida novamente no BFF", () => {
    expect(publicPage).toContain("privacy_type");
    expect(publicPage).toContain("O que você precisa sobre seus dados?");
    for (const type of privacyTypes) {
      expect(publicPage).toContain(`value=\"${type}\"`);
      expect(endpoint).toContain(`\"${type}\"`);
    }
    expect(endpoint).toContain("requested_privacy_type");
    expect(endpoint).toContain("privacyTypes.has(privacyType)");
  });

  it("faz backfill, aplica alvo de 15 dias e mantém compatibilidade server-only", () => {
    expect(migration.trimStart()).toMatch(/^begin;/);
    expect(migration.trimEnd()).toMatch(/commit;$/);
    expect(migration).toContain("privacy_request_type");
    expect(migration).toContain("privacy_due_at");
    expect(migration).toContain("created_at + interval '15 days'");
    expect(migration).toContain("now() + interval '15 days'");
    expect(migration).toContain("site_feedback_privacy_workflow_check");
    expect(migration).toContain("site_feedback_privacy_due_idx");
    expect(migration).toContain("requested_privacy_type text");
    expect(migration).toContain("case when requested_category = 'privacy' then 'other' else null end");
    expect(migration).toContain("to service_role");
    expect(migration).toContain("from public, anon, authenticated");
  });

  it("prioriza vencidas e registra resolução, fechamento e auditoria", () => {
    expect(migration).toContain("feedback.privacy_due_at < now()");
    expect(migration).toContain("request_row.overdue desc");
    expect(migration).toContain("for update");
    expect(migration).toContain("privacy_resolved_at");
    expect(migration).toContain("privacy_closed_at");
    expect(migration).toContain("'was_overdue'");
    expect(migration).toContain("'privacy_request.updated'");
    expect(operation).toContain("Prazo interno");
    expect(operation).toContain("atrasada(s)");
    expect(operation).toContain("privacyTypeLabel");
    expect(operation).toContain("item.overdue");
  });

  it("não transforma o prazo interno em afirmação legal automática", () => {
    expect(publicPage).not.toMatch(/prazo legal|garantia legal|15 dias por lei/i);
    expect(operation).toContain("Prazo interno");
  });
});
