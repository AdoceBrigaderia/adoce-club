import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  new URL(
    "../.github/workflows/deploy-homologation-v2.yml",
    import.meta.url,
  ),
  "utf8",
);
const playwright = readFileSync(
  new URL("../playwright.config.mjs", import.meta.url),
  "utf8",
);

describe("publicação manual e isolada da homologação", () => {
  it("só pode ser iniciada manualmente para branch e commit exatos", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toMatch(/\n\s+push:/);
    expect(workflow).not.toMatch(/\n\s+pull_request:/);
    expect(workflow).toContain(
      "EXPECTED_BRANCH: reestruturacao/ux-crm-operacao-imagens-v1",
    );
    expect(workflow).toContain('test "$(git rev-parse HEAD)" = "$EXPECTED_COMMIT"');
    expect(workflow).toContain(
      'test "$CONFIRMATION" = "PUBLICAR SOMENTE HOMOLOGACAO"',
    );
  });

  it("exige projeto Netlify separado e jamais usa flag de produção", () => {
    expect(workflow).toContain("NETLIFY_HOMOLOGATION_SITE_ID");
    expect(workflow).toContain("NETLIFY_PRODUCTION_SITE_ID");
    expect(workflow).toContain(
      'test "$HOMOLOGATION_SITE_ID" != "$PRODUCTION_SITE_ID"',
    );
    expect(workflow).toContain("--alias homologacao-adoce");
    expect(workflow).toContain("--no-build");
    expect(workflow).not.toMatch(/\s--prod(?:\s|$)/);
    expect(workflow).not.toContain("release:prod");
  });

  it("usa a URL devolvida pelo deploy e não um endereço estático antigo", () => {
    expect(workflow).toContain(
      "const deployUrl = deploy.deploy_url || deploy.ssl_url || deploy.url",
    );
    expect(workflow).toContain("HOMOLOGATION_DEPLOY_URL=");
    expect(workflow).toContain("belongsToHomologationSite");
    expect(workflow).toContain("deployedHost.endsWith(`--${expectedHost}`)");
    expect(workflow).toContain("artifacts/homologation-deploy-url.txt");
    expect(workflow).not.toContain('SMOKE_URL: ${{ vars.HOMOLOGATION_SITE_URL }}');
  });

  it("gera e preserva pré-flight redigido antes do deploy", () => {
    expect(workflow).toContain("report:homologation-preflight");
    expect(workflow).toContain("ADOCE_PREFLIGHT_COMMIT");
    expect(workflow).toContain("artifacts/homologation-preflight.json");
    expect(workflow).toContain("artifacts/homologation-preflight.md");
  });

  it("lê variáveis do cofre Netlify e verifica readiness antes do smoke", () => {
    expect(workflow).toContain("dev:exec --context");
    expect(workflow).toContain("gate:homologation-environment");
    expect(workflow).toContain(
      '"$HOMOLOGATION_DEPLOY_URL/api/homologation-readiness"',
    );
    expect(workflow).toContain("payload.coreReady !== true");
    expect(workflow).toContain("payload.security?.configured !== true");
    expect(workflow).toContain("payload.supabase?.isolated !== true");
  });

  it("executa Playwright diretamente contra o deploy exato publicado", () => {
    expect(workflow).toContain(
      'PLAYWRIGHT_BASE_URL="$HOMOLOGATION_DEPLOY_URL" npx playwright test',
    );
    expect(playwright).toContain("process.env.PLAYWRIGHT_BASE_URL");
    expect(playwright).toContain("webServer: externalBaseURL");
  });

  it("não leva credenciais de aplicação para o GitHub Actions", () => {
    expect(workflow).not.toContain("META_WA_ACCESS_TOKEN");
    expect(workflow).not.toContain("META_WA_APP_SECRET");
    expect(workflow).not.toContain("GOOGLE_WALLET_PRIVATE_KEY");
    expect(workflow).not.toContain("SUPABASE_SECRET_KEY");
    expect(workflow).not.toContain("WHATSAPP_OTP_PEPPER");
    expect(workflow).not.toContain("PUBLIC_RATE_LIMIT_PEPPER");
  });
});
