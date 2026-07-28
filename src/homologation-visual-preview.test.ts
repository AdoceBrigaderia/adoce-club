import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const main = readFileSync("src/main.tsx", "utf8");
const banner = readFileSync("src/HomologationValidationBanner.tsx", "utf8");
const navigator = readFileSync("src/HomologationVisualNavigator.tsx", "utf8");
const reviewModel = readFileSync("src/homologation-visual-review.ts", "utf8");
const styles = readFileSync("src/homologation-validation.css", "utf8");
const previewServer = readFileSync(
  "scripts/serve-homologation-preview.mjs",
  "utf8",
);
const workflow = readFileSync(
  ".github/workflows/homologation-visual-preview.yml",
  "utf8",
);

const normalizedBanner = banner.replace(/\s+/g, " ");

describe("preview de validação visual da homologação", () => {
  it("marca o preview sem contaminar os demais ambientes", () => {
    expect(banner).toContain('value === "visual"');
    expect(banner).toContain("Homologação — validação visual");
    expect(normalizedBanner).toContain(
      "Ações transacionais e integrações externas",
    );
    expect(main).toContain("<HomologationValidationBanner />");
    expect(main).toContain("VITE_ADOCE_VALIDATION_MODE");
    expect(styles).toContain(".homologation-validation-banner");
  });

  it("oferece roteiro touch com identidade oficial apenas no preview", () => {
    expect(navigator).toContain('value === "visual"');
    expect(navigator).toContain('src="/site/logo.webp"');
    expect(navigator).toContain("Logo oficial da Adoce Brigaderia");
    expect(navigator).toContain("Roteiro de validação");
    expect(reviewModel).toContain("Cadastro simplificado");
    expect(reviewModel).toContain("Operação");
    expect(navigator).toContain("Relatório identificado por commit");
    expect(main).toContain("<HomologationVisualNavigator />");
    expect(styles).toContain(".homologation-visual-navigator");
    expect(styles).toContain("min-height: 48px");
  });

  it("acelera a revisão levando à próxima tela pendente", () => {
    expect(reviewModel).toContain("nextPendingVisualRoute");
    expect(navigator).toContain("Próxima tela pendente");
    expect(navigator).toContain("Todas as telas foram revisadas");
    expect(styles).toContain(".homologation-visual-next-route");
    expect(reviewModel).toContain("Pronta para envio");
    expect(reviewModel).toContain("Telas pendentes");
  });

  it("permite revisar telas e copiar relatório sem backend", () => {
    expect(navigator).toContain("sessionStorage");
    expect(navigator).toContain("VISUAL_REVIEW_SESSION_KEY");
    expect(navigator).toContain('aria-pressed={status === "approved"}');
    expect(navigator).toContain('aria-pressed={status === "adjust"}');
    expect(navigator).toContain("Copiar relatório");
    expect(navigator).toContain("navigator.clipboard");
    expect(reviewModel).toContain("buildVisualReviewMarkdown");
    expect(reviewModel).toContain("Produção não foi alterada por esta validação.");
    expect(styles).toContain(".homologation-visual-review-progress");
    expect(styles).toContain(".homologation-visual-review-notes");
  });

  it("não registra service worker no preview visual", () => {
    expect(main).toContain(
      'if (!visualValidationMode && "serviceWorker" in navigator)',
    );
  });

  it("mantém publicação estática, rastreável e isolada de produção", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("push:");
    expect(workflow).toContain("- src/HomologationVisualNavigator.tsx");
    expect(workflow).toContain("- src/homologation-visual-review.ts");
    expect(workflow).toContain("- scripts/serve-homologation-preview.mjs");
    expect(workflow).toContain(
      "github.event_name == 'workflow_dispatch' && inputs.confirmation",
    );
    expect(workflow).toContain(
      "github.event_name == 'workflow_dispatch' && inputs.expected_commit",
    );
    expect(workflow).toContain("ref: ${{ github.sha }}");
    expect(workflow).not.toContain(
      "ref: reestruturacao/ux-crm-operacao-imagens-v1",
    );
    expect(workflow).toContain('test "$CONFIRMATION" = "PUBLICAR VALIDACAO VISUAL"');
    expect(workflow).toContain('test "$GITHUB_REF_NAME" = "$EXPECTED_BRANCH"');
    expect(workflow).toContain('test "$(git rev-parse HEAD)" = "$GITHUB_SHA"');
    expect(workflow).toContain('test "$(git rev-parse HEAD)" = "$EXPECTED_COMMIT"');
    expect(workflow).toContain('test "$HOMOLOGATION_SITE_ID" != "$PRODUCTION_SITE_ID"');
    expect(workflow).toContain("f0cc51be-a0ec-4451-9644-a394592cdc37");
    expect(workflow).toContain("bb0c96cd-5af2-4270-a9a8-b63b9637b1f4");
    expect(workflow).toContain("VITE_ADOCE_VALIDATION_MODE: visual");
    expect(workflow).toContain("VITE_ADOCE_PREVIEW_COMMIT");
    expect(workflow).toContain("VITE_ADOCE_PREVIEW_BUILT_AT");
    expect(workflow).toContain("npm run verify:fast");
    expect(workflow).toContain("--alias validacao-visual-adoce");
    expect(workflow).toContain("--dir dist");
    expect(workflow).not.toContain("--prod");
    expect(workflow).not.toContain("--functions");
    expect(workflow).toContain("Domínio de produção proibido");
  });

  it("gera pacote offline executável antes de depender da Netlify", () => {
    const offlineBuild = workflow.indexOf(
      "Gerar preview visual offline independente da Netlify",
    );
    const offlineUpload = workflow.indexOf(
      "Preservar preview offline para teste imediato",
    );
    const credentialCheck = workflow.indexOf(
      "Verificar disponibilidade da credencial Netlify",
    );

    expect(offlineBuild).toBeGreaterThan(-1);
    expect(offlineUpload).toBeGreaterThan(offlineBuild);
    expect(credentialCheck).toBeGreaterThan(offlineUpload);
    expect(workflow).toContain("npm run build");
    expect(workflow).toContain("homologacao-visual-offline-${{ github.sha }}");
    expect(workflow).toContain("steps.offline-upload.outputs.artifact-url");
    expect(workflow).toContain("steps.offline-upload.outputs.artifact-digest");
    expect(workflow).toContain("INICIAR-PREVIEW-WINDOWS.cmd");
    expect(workflow).toContain("INICIAR-PREVIEW-LINUX-MAC.command");
    expect(workflow).toContain("node servidor-preview.mjs --open");
    expect(workflow).toContain("http://127.0.0.1:4187/operacao/venda-rapida");
    expect(workflow).toContain("Não é necessário instalar pacotes nem acessar a internet");
    expect(workflow).not.toContain("npx --yes serve@14.2.4 -s dist -l 4173");
    expect(workflow).toContain("retention-days: 14");
  });

  it("mantém o servidor local restrito e compatível com rotas SPA", () => {
    expect(previewServer).toContain('const DEFAULT_HOST = "127.0.0.1"');
    expect(previewServer).toContain("createPreviewServer");
    expect(previewServer).toContain("resolveRequestPath");
    expect(previewServer).toContain('resolve(root, "index.html")');
    expect(previewServer).toContain('"X-Content-Type-Options": "nosniff"');
    expect(previewServer).toContain('"Referrer-Policy": "no-referrer"');
    expect(previewServer).toContain("aceita somente localhost/127.0.0.1");
    expect(previewServer).toContain("Produção não foi alterada.");
  });

  it("não transforma ausência do token em falha do preview offline", () => {
    expect(workflow).toContain('echo "configured=false" >> "$GITHUB_OUTPUT"');
    expect(workflow).toContain(
      "o preview offline foi preservado e a publicação web será ignorada",
    );
    expect(workflow).toContain(
      "if: ${{ steps.netlify-auth.outputs.configured == 'true' }}",
    );
    expect(workflow).toContain(
      "if: ${{ steps.netlify-auth.outputs.configured != 'true' && success() }}",
    );
    expect(workflow).not.toContain(
      "NETLIFY_AUTH_TOKEN não está configurado no environment homologation.",
    );
  });

  it("publica URL, pacote offline ou falha real somente no issue", () => {
    expect(workflow).toContain("issues: write");
    expect(workflow).toContain("issue_number: 3");
    expect(workflow).toContain("Preview visual publicado");
    expect(workflow).toContain("Preview visual offline disponível");
    expect(workflow).toContain("Preview visual bloqueado por falha real");
    expect(workflow).toContain("actions/runs/${context.runId}");
    expect(workflow).toContain("Produção: **não alterada**");
    expect(workflow).not.toContain("pulls/10/merge");
  });
});
