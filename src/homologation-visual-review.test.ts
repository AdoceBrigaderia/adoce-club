import { describe, expect, it } from "vitest";
import {
  buildVisualReviewMarkdown,
  createEmptyVisualReview,
  normalizeVisualReview,
  visualReviewProgress,
} from "./homologation-visual-review";

describe("checklist de validação visual", () => {
  it("começa com todas as telas pendentes e sem observações por rota", () => {
    const review = createEmptyVisualReview();

    expect(visualReviewProgress(review)).toEqual({
      total: 8,
      approved: 0,
      adjust: 0,
      pending: 8,
      reviewed: 0,
    });
    expect(Object.values(review.routeNotes)).toEqual(Array(8).fill(""));
  });

  it("normaliza estado armazenado sem aceitar status ou texto arbitrário", () => {
    const review = normalizeVisualReview({
      statuses: {
        inicio: "approved",
        cadastro: "invalid",
        operacao: "adjust",
      },
      routeNotes: {
        inicio: "Identidade correta.",
        operacao: "b".repeat(1000),
        cadastro: 123,
      },
      notes: "a".repeat(5000),
      updatedAt: 123,
    });

    expect(review.statuses.inicio).toBe("approved");
    expect(review.statuses.cadastro).toBe("pending");
    expect(review.statuses.operacao).toBe("adjust");
    expect(review.routeNotes.inicio).toBe("Identidade correta.");
    expect(review.routeNotes.operacao).toHaveLength(800);
    expect(review.routeNotes.cadastro).toBe("");
    expect(review.notes).toHaveLength(4000);
    expect(review.updatedAt).toBeNull();
  });

  it("mantém compatibilidade com revisões antigas sem observações por rota", () => {
    const review = normalizeVisualReview({
      statuses: { inicio: "approved" },
      notes: "Revisão anterior",
    });

    expect(review.statuses.inicio).toBe("approved");
    expect(review.routeNotes.inicio).toBe("");
    expect(review.notes).toBe("Revisão anterior");
  });

  it("gera relatório copiável com rastreabilidade e observações por tela", () => {
    const review = createEmptyVisualReview();
    review.statuses.inicio = "approved";
    review.statuses.operacao = "adjust";
    review.routeNotes.operacao = "Aumentar o botão principal\nno tablet.";
    review.notes = "Revisar contraste geral das mensagens de sucesso.";
    review.updatedAt = "2026-07-27T23:40:00Z";

    const report = buildVisualReviewMarkdown(review, {
      commit: "abc123",
      builtAt: "2026-07-27T22:00:00Z",
      url: "https://validacao-visual-adoce--adoce-homologacao.netlify.app",
      viewport: "390x844 @3.00x",
    });

    expect(report).toContain("Commit: abc123");
    expect(report).toContain("Viewport: 390x844 @3.00x");
    expect(report).toContain("Última atualização: 2026-07-27T23:40:00Z");
    expect(report).toContain("2/8 telas revisadas");
    expect(report).toContain("Início e identidade: Aprovado");
    expect(report).toContain("Operação: Precisa ajustar");
    expect(report).toContain("Observação: Aumentar o botão principal no tablet.");
    expect(report).toContain("Revisar contraste geral das mensagens de sucesso.");
    expect(report).toContain("Produção não foi alterada por esta validação.");
  });
});
