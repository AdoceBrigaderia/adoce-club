import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260718184839_add_member_codes_and_rollback_audit.sql",
    import.meta.url,
  ),
  "utf8",
);
const rollbackFunction = readFileSync(
  new URL("../netlify/functions/production-rollback.ts", import.meta.url),
  "utf8",
);
const memberArea = readFileSync(
  new URL("./PasskeyClientGateway.tsx", import.meta.url),
  "utf8",
);
const landing = readFileSync(
  new URL("./MarketingLanding.tsx", import.meta.url),
  "utf8",
);
const clubExperience = readFileSync(
  new URL("./ClubExperience.tsx", import.meta.url),
  "utf8",
);

describe("terminologia do Clube Adoce", () => {
  it("mantém a identidade pública e o cartão real do cliente", () => {
    expect(landing).toContain("Feito pelas mãos da Beth.");
    expect(clubExperience).toContain(
      "Seu cartão agora é digital — <em>mas a tradição continua.</em>",
    );
    expect(clubExperience).toContain(
      "A cada fatia, você ganha 1 carimbo. Complete 14 e ganhe uma fatia grátis.",
    );
    expect(memberArea).toContain("Área do cliente");
    expect(memberArea).toContain("Meu cartão digital");
    expect(memberArea).toContain("Código do membro");
    expect(memberArea).toContain("fatia(s) grátis");
  });

  it("mantém 14 espaços visuais, QR e Google Wallet no cartão atual", () => {
    expect(memberArea).toContain("Array.from({ length: 14 }");
    expect(memberArea).toContain("Mostrar meu QR");
    expect(memberArea).toContain("CustomerGoogleWalletButton");
    expect(memberArea).toContain("customer_get_account_workspace");
  });
});

describe("Código do membro", () => {
  it("cria um código anual, sequencial, único e imutável", () => {
    expect(migration).toContain("'ADOC ' || joined_year::text");
    expect(migration).toContain(
      "profiles_member_code_unique unique (member_code)",
    );
    expect(migration).toContain("create trigger profiles_assign_member_code");
    expect(migration).toContain("create trigger profiles_preserve_member_code");
  });
});

describe("restauração protegida de produção", () => {
  it("exige proprietário, confirmação e mantém o token fora do navegador", () => {
    expect(rollbackFunction).toContain('staff.role !== "owner"');
    expect(rollbackFunction).toContain(
      'body.confirmation !== "RESTAURAR PRODUCAO"',
    );
    expect(rollbackFunction).toContain('env("NETLIFY_AUTH_TOKEN")');
    expect(rollbackFunction).not.toContain("VITE_NETLIFY_AUTH_TOKEN");
  });

  it("restaura um deploy seguro fixado e registra auditoria", () => {
    expect(rollbackFunction).toContain('env("NETLIFY_SAFE_DEPLOY_ID")');
    expect(rollbackFunction).toContain("/restore`");
    expect(rollbackFunction).toContain("record_owner_production_rollback");
  });
});
