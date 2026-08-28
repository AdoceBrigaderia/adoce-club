import { describe, expect, it } from "vitest";
import {
  EXPERIENCIAS,
  conteudoDe,
  mensagemDaExperiencia,
  type Experiencia,
} from "./experiencias-adoce";

const chaves: Experiencia[] = ["events", "school", "rentals"];

describe("as três linhas existem e têm o mesmo tratamento", () => {
  // "enquanto a Beth não falar que vamos encerrar, isso precisa fazer parte"
  it("as três estão presentes", () => {
    expect(EXPERIENCIAS.map((e) => e.chave)).toEqual(chaves);
  });

  it("nenhuma fica com conteúdo pela metade", () => {
    for (const e of EXPERIENCIAS) {
      expect(e.titulo.length).toBeGreaterThan(3);
      expect(e.promessa.length).toBeGreaterThan(20);
      expect(e.intro.length).toBeGreaterThan(60);
      expect(e.comoFunciona).toHaveLength(3);
      expect(e.precisamosSaber.length).toBeGreaterThanOrEqual(3);
      expect(e.prazoDiasUteis).toBeGreaterThan(0);
    }
  });

  it("cada passo tem título e texto", () => {
    for (const e of EXPERIENCIAS) {
      for (const p of e.comoFunciona) {
        expect(p.titulo.length).toBeGreaterThan(5);
        expect(p.texto.length).toBeGreaterThan(15);
      }
    }
  });
});

describe("a promessa fala do cliente, não da Adoce", () => {
  it("nenhuma promessa começa falando de nós", () => {
    for (const e of EXPERIENCIAS) {
      const p = e.promessa.toLowerCase();
      expect(p.startsWith("nós")).toBe(false);
      expect(p.startsWith("a adoce")).toBe(false);
      expect(p.startsWith("oferecemos")).toBe(false);
    }
  });

  it("a escola fala da criança, que é quem importa ali", () => {
    expect(conteudoDe("school")?.promessa.toLowerCase()).toContain("aniversário");
  });

  it("a decoração fala do custo, que é a objeção real", () => {
    expect(conteudoDe("rentals")?.intro.toLowerCase()).toContain("barato");
  });
});

describe("prazos batem com a operação", () => {
  it("escola pede cinco dias úteis; as outras, três", () => {
    expect(conteudoDe("school")?.prazoDiasUteis).toBe(5);
    expect(conteudoDe("events")?.prazoDiasUteis).toBe(3);
    expect(conteudoDe("rentals")?.prazoDiasUteis).toBe(3);
  });
});

describe("mensagem para o WhatsApp", () => {
  it("já leva as perguntas que a Adoce precisa responder para orçar", () => {
    const texto = mensagemDaExperiencia("school");
    expect(texto).toContain("A data:");
    expect(texto).toContain("Quantas crianças:");
    expect(texto).toContain("O nome do aniversariante:");
  });

  it("usa o nome do produto quando veio de um", () => {
    expect(mensagemDaExperiencia("events", "Tabuleiro de doces - 200 colheres"))
      .toContain("Tabuleiro de doces - 200 colheres");
  });

  it("não manda link — cliente sem dado móvel não abre", () => {
    for (const c of chaves) expect(mensagemDaExperiencia(c)).not.toContain("http");
  });

  it("chave desconhecida não gera mensagem torta", () => {
    expect(mensagemDaExperiencia("nada" as Experiencia)).toBe("");
  });
});

describe("nada fecha sozinho no site", () => {
  it("as três passam por conversa antes de virar pedido", () => {
    // Não existe custo apurado por composição, e a data precisa ser combinada.
    for (const e of EXPERIENCIAS) {
      expect(e.precisamosSaber).toContain("A data");
    }
  });
});
