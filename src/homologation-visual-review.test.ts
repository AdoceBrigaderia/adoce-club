import { describe, expect, it } from "vitest";
import {
  buildVisualReviewMarkdown,
  createEmptyVisualReview,
  normalizeVisualReview,
  visualReviewProgress,
} from "./homologation-visual-review";

describe("checklist de validação visual", () => {
  it("começa com todas as telas pendentes", () => {
    const review = createEmptyVisualReview();

    expect(visualReviewProgress(review)).toEqual({
      total: 8,
      approved: 0,
      adjust: 0,
      pending: 8,
      reviewed: 0,
    });
  });

  it("normaliza estado armazenado sem aceitar status ou texto arbitrário", () => {
    const review = normalizeVisualReview({
      statuses: {
        inicio: "approved",
        cadastro: "invalid",
        operacao: "adjust",
      },
      notes: "a".repeat(5000),
      updatedAt: 123,
    });

    expect(review.statuses.inicio).toBe("approved");
    expect(review.statuses.cadastro).toBe("pending");
    expect(review.statuses.operacao).toBe("adjust");
    expect(review.notes).toHaveLength(4000);
    expect(review.updatedAt).toBeNull();
  });

  it("gera relatório copiável com rastreabilidade e sem sugerir produção", () => {
    const review = createEmptyVisualReview();
    review.statuses.inicio = "approved";
    review.statuses.operacao = "adjust";
    review.notes = "Aumentar contraste do botão principal no tablet.";

    const report = buildVisualReviewMarkdown(review, {
      commit: "abc123",
      builtAt: "2026-07-27T22:00:00Z",
      url: "https://validacao-visual-adoce--adoce-homologacao.netlify.app",
    });

    expect(report).toContain("Commit: abc123");
    expect(report).toContain("2/8 telas revisadas");
    expect(report).toContain("Início e identidade: Aprovado");
    expect(report).toContain("Operação: Precisa ajustar");
    expect(report).toContain("Aumentar contraste do botão principal no tablet.");
    expect(report).toContain("Produção não foi alterada por esta validação.");
  });
});
