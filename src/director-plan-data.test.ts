import { describe, expect, it } from "vitest";
import {
  DIRECTOR_ARCHIVED_DECISION_COUNT,
  DIRECTOR_DECISIONS,
} from "./director-plan-data";

describe("pendências do Plano Diretor", () => {
  it("mostra somente as decisões que ainda exigem validação", () => {
    expect(DIRECTOR_DECISIONS).toHaveLength(24);
    expect(DIRECTOR_ARCHIVED_DECISION_COUNT).toBe(46);
    expect(DIRECTOR_DECISIONS.map((decision) => decision.id)).not.toContain("D01");
    expect(DIRECTOR_DECISIONS.map((decision) => decision.id)).toContain("D50");
  });

  it("usa o equipamento real informado para o teste de impressão", () => {
    const printerDecision = DIRECTOR_DECISIONS.find((decision) => decision.id === "D50");

    expect(printerDecision?.question).toContain("Galaxy Tab A7 Lite");
    expect(printerDecision?.question).not.toContain("VAIO TL10");
  });

  it("mantém códigos únicos para preservar as respostas históricas", () => {
    const ids = DIRECTOR_DECISIONS.map((decision) => decision.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});
