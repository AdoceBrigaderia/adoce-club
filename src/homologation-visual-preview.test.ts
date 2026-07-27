import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const main = readFileSync("src/main.tsx", "utf8");
const banner = readFileSync("src/HomologationValidationBanner.tsx", "utf8");
const navigator = readFileSync("src/HomologationVisualNavigator.tsx", "utf8");
const reviewModel = readFileSync("src/homologation-visual-review.ts", "utf8");
const styles = readFileSync("src/homologation-validation.css", "utf8");
const workflow = readFileSync(
  ".github/workflows/homologation-visual-preview.yml",
  "utf8",
);

describe("preview de validação visual da homologação", () => {
  it("marca o preview sem contaminar os demais ambientes", () => {
    expect(banner).toContain('value === "visual"');
    expect(banner).toContain("Homologação — validação visual");
    expect(banner).toContain("Ações transacionais e integrações externas");
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
    expect(navigator).toContain("Identidade visual carregada diretamente");
    expect(main).toContain("<HomologationVisualNavigator />");
    expect(styles).toContain(".homologation-visual-navigator");
    expect(styles).toContain("min-height: 48px");
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

  it("mantém publicação estática e isolada de produção", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("push:");
    expect(workflow).toContain(
      "- .github/workflows/homologation-visual-preview.yml",
    );
    expect(workflow).toContain(
      "github.event_name == 'workflow_dispatch' && inputs.confirmation",
    );
    expect(workflow).toContain(
      "github.event_name == 'workflow_dispatch' && inputs.expected_commit",
    );
    expect(workflow).toContain('test "$CONFIRMATION" = "PUBLICAR VALIDACAO VISUAL"');
    expect(workflow).toContain('test "$(git rev-parse HEAD)" = "$EXPECTED_COMMIT"');
    expect(workflow).toContain('test "$HOMOLOGATION_SITE_ID" != "$PRODUCTION_SITE_ID"');
    expect(workflow).toContain("f0cc51be-a0ec-4451-9644-a394592cdc37");
    expect(workflow).toContain("bb0c96cd-5af2-4270-a9a8-b63b9637b1f4");
    expect(workflow).toContain("VITE_ADOCE_VALIDATION_MODE=visual");
    expect(workflow).toContain("VITE_ADOCE_PREVIEW_COMMIT");
    expect(workflow).toContain("VITE_ADOCE_PREVIEW_BUILT_AT");
    expect(workflow).toContain("npm run verify:fast");
    expect(workflow).toContain("--alias validacao-visual-adoce");
    expect(workflow).toContain("--dir dist");
    expect(workflow).not.toContain("--prod");
    expect(workflow).not.toContain("--functions");
    expect(workflow).toContain("Domínio de produção proibido");
  });

  it("publica URL ou bloqueio objetivo somente no issue de acompanhamento", () => {
    expect(workflow).toContain("issues: write");
    expect(workflow).toContain("repos/${GITHUB_REPOSITORY}/issues/3/comments");
    expect(workflow).toContain("Preview visual publicado");
    expect(workflow).toContain("Preview visual bloqueado");
    expect(workflow).toContain("NETLIFY_AUTH_TOKEN não está configurado");
    expect(workflow).toContain("actions/runs/${GITHUB_RUN_ID}");
    expect(workflow).toContain("Produção: não alterada");
    expect(workflow).not.toContain("pulls/10/merge");
  });
});
