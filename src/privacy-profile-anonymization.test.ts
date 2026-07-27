import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260727180000_privacy_profile_anonymization.sql",
    import.meta.url,
  ),
  "utf8",
);
const emailGuard = readFileSync(
  new URL(
    "../supabase/migrations/20260727181000_privacy_anonymization_null_email_guard.sql",
    import.meta.url,
  ),
  "utf8",
);
const identityFix = readFileSync(
  new URL(
    "../supabase/migrations/20260727182000_privacy_anonymization_generated_identity_email_fix.sql",
    import.meta.url,
  ),
  "utf8",
);
const memberCodeFix = readFileSync(
  new URL(
    "../supabase/migrations/20260727183000_privacy_anonymization_preserve_member_code.sql",
    import.meta.url,
  ),
  "utf8",
);
const policy = readFileSync(
  new URL("../netlify/functions/_shared/bff-rpc-policy.ts", import.meta.url),
  "utf8",
);

describe("anonimização protegida do cadastro", () => {
  it("restringe plano e execução ao proprietário com identidade confirmada", () => {
    expect(migration).toContain("private.current_staff_role()::text <> 'owner'");
    expect(migration).toContain("privacy_request_type <> 'deletion'");
    expect(migration).toContain(
      "coalesce(request_row.privacy_identity_status, 'pending') <> 'verified'",
    );
    expect(migration).toContain("requested_confirmation");
    expect(migration).toContain("Digite o protocolo exato");
  });

  it("bloqueia equipe, atendimento aberto e conta de fidelidade compartilhada", () => {
    expect(migration).toContain("staff_profile");
    expect(migration).toContain("open_orders");
    expect(migration).toContain("open_service_requests");
    expect(migration).toContain("shared_loyalty_accounts");
    expect(migration).toContain("Resolva os bloqueios do plano");
  });

  it("preserva registros financeiros sem contato direto e revoga acessos", () => {
    expect(migration).toContain("customer_name = 'Cliente Anonimizado'");
    expect(migration).toContain("customer_phone = '+5500000000000'");
    expect(migration).toContain("delete from auth.refresh_tokens");
    expect(migration).toContain("delete from auth.sessions");
    expect(migration).toContain("delete from auth.webauthn_credentials");
    expect(migration).toContain("status = 'revoked'");
    expect(migration).toContain("account_status = 'anonymized'");
    expect(migration).toContain("'privacy_request.profile_anonymized'");
  });

  it("não coloca contato original no payload de auditoria", () => {
    const auditBlock = migration.slice(
      migration.indexOf("'privacy_request.profile_anonymized'"),
      migration.indexOf("return jsonb_build_object", migration.indexOf("'privacy_request.profile_anonymized'")),
    );
    expect(auditBlock).not.toContain("profile_row.email");
    expect(auditBlock).not.toContain("profile_row.phone_e164");
    expect(auditBlock).not.toContain("profile_row.full_name");
    expect(auditBlock).toContain("orders_anonymized");
    expect(auditBlock).toContain("service_requests_anonymized");
  });

  it("protege cadastro sem e-mail e respeita colunas geradas do Auth", () => {
    expect(emailGuard).toContain("Cadastro sem e-mail exige revisão manual");
    expect(emailGuard).toContain("staff_anonymize_privacy_profile_core");
    expect(identityFix).toContain("pg_get_functiondef");
    expect(identityFix).toContain("update auth.users");
    expect(identityFix).toContain("anonymous_email");
  });

  it("preserva o código imutável e invalida QR, Wallet e conta", () => {
    expect(memberCodeFix).toContain("member_code = anonymous_member_code");
    expect(memberCodeFix).toContain("corrected_definition := replace");
    expect(migration).toContain("delete from public.customer_qr_tokens");
    expect(migration).toContain("update public.customer_wallet_passes");
    expect(migration).toContain("update public.loyalty_accounts");
    expect(migration).toContain("active = false");
  });

  it("expõe apenas os RPCs protegidos pela fronteira BFF", () => {
    expect(policy).toContain('"staff_get_privacy_anonymization_plan"');
    expect(policy).toContain('"staff_anonymize_privacy_profile"');
    expect(migration).toContain(
      "revoke all on function public.staff_get_privacy_anonymization_plan(uuid)",
    );
    expect(emailGuard).toContain(
      "revoke all on function public.staff_anonymize_privacy_profile(uuid,text)",
    );
  });
});
