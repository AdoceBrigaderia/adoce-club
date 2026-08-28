import { describe, expect, it } from "vitest";
import {
  MULTIPLO,
  ajustarParaMultiplo,
  cabeMais,
  comporPacotes,
  descreverComposicao,
  ehQuantidadeValida,
  faltaPara,
  pedidoCompleto,
  podeSomar,
  saboresPermitidos,
  somar,
  subtrair,
  totalEscolhido,
  type Escolha,
} from "./pacotes-de-docinhos";

describe("composição automática de pacotes", () => {
  // "125 unidades = 100 + 25"
  it("monta 125 como 100 + 25", () => {
    expect(comporPacotes(125)).toEqual([100, 25]);
    expect(descreverComposicao(125)).toBe("100 + 25");
  });

  it("usa sempre o maior pacote possível", () => {
    expect(comporPacotes(175)).toEqual([100, 50, 25]);
    expect(comporPacotes(200)).toEqual([100, 100]);
    expect(comporPacotes(75)).toEqual([50, 25]);
  });

  it("abaixo de 25 não existe pedido", () => {
    expect(comporPacotes(24)).toEqual([]);
    expect(comporPacotes(0)).toEqual([]);
  });

  it("descarta a sobra que não fecha um múltiplo", () => {
    expect(comporPacotes(130)).toEqual([100, 25]);
  });
});

describe("quantidade válida", () => {
  it("só múltiplos de 25 a partir de 25", () => {
    expect(ehQuantidadeValida(25)).toBe(true);
    expect(ehQuantidadeValida(100)).toBe(true);
    expect(ehQuantidadeValida(15)).toBe(false);
    expect(ehQuantidadeValida(0)).toBe(false);
  });

  it("arredonda o que for digitado errado", () => {
    expect(ajustarParaMultiplo(15)).toBe(25);
    expect(ajustarParaMultiplo(60)).toBe(50);
    expect(ajustarParaMultiplo(63)).toBe(75);
    expect(ajustarParaMultiplo(0)).toBe(0);
  });
});

describe("quantos sabores cabem", () => {
  it("um sabor a cada 25 unidades", () => {
    expect(saboresPermitidos(25)).toBe(1);
    expect(saboresPermitidos(50)).toBe(2);
    expect(saboresPermitidos(100)).toBe(4);
  });
});

describe("o limite impede em vez de avisar depois", () => {
  // O print do Rubens: "Escolha no máximo 1 sabor(es)" aparecia DEPOIS de
  // ele já ter escolhido Ninho 15, Nesquik 14 e Amendoim 10.
  it("no pacote de 25, escolhido um sabor, os outros ficam bloqueados", () => {
    const escolhas: Escolha[] = [{ sabor: "Ninho", unidades: 25 }];
    expect(podeSomar(escolhas, 25, "Nesquik")).toBe(false);
    expect(podeSomar(escolhas, 25, "Amendoim")).toBe(false);
    expect(cabeMais(escolhas, 25, "Nesquik")).toBe(0);
  });

  it("somar num sabor bloqueado não muda nada", () => {
    const escolhas: Escolha[] = [{ sabor: "Ninho", unidades: 25 }];
    expect(somar(escolhas, 25, "Nesquik")).toEqual(escolhas);
  });

  it("no pacote de 100 cabem quatro sabores, e o quinto não", () => {
    let escolhas: Escolha[] = [];
    for (const sabor of ["Ninho", "Brigadeiro", "Beijinho", "Nesquik"]) {
      escolhas = somar(escolhas, 100, sabor);
    }
    expect(totalEscolhido(escolhas)).toBe(100);
    expect(podeSomar(escolhas, 100, "Amendoim")).toBe(false);
    expect(pedidoCompleto(escolhas, 100)).toBe(true);
  });

  it("um sabor pode ocupar o pacote inteiro", () => {
    let escolhas: Escolha[] = [];
    escolhas = somar(escolhas, 100, "Ninho");
    escolhas = somar(escolhas, 100, "Ninho");
    escolhas = somar(escolhas, 100, "Ninho");
    escolhas = somar(escolhas, 100, "Ninho");
    expect(escolhas).toEqual([{ sabor: "Ninho", unidades: 100 }]);
    expect(pedidoCompleto(escolhas, 100)).toBe(true);
  });
});

describe("somar e subtrair andam de 25 em 25", () => {
  it("cada toque vale 25", () => {
    const escolhas = somar([], 100, "Ninho");
    expect(escolhas).toEqual([{ sabor: "Ninho", unidades: MULTIPLO }]);
  });

  it("nunca produz 15, 14 ou 10", () => {
    let escolhas: Escolha[] = [];
    for (let i = 0; i < 4; i += 1) escolhas = somar(escolhas, 100, "Ninho");
    for (const e of escolhas) expect(e.unidades % MULTIPLO).toBe(0);
  });

  it("subtrair remove o sabor quando chega a zero", () => {
    const escolhas = subtrair([{ sabor: "Ninho", unidades: 25 }], "Ninho");
    expect(escolhas).toEqual([]);
  });

  it("depois de remover, o sabor volta a caber", () => {
    let escolhas: Escolha[] = [{ sabor: "Ninho", unidades: 25 }];
    expect(podeSomar(escolhas, 25, "Nesquik")).toBe(false);
    escolhas = subtrair(escolhas, "Ninho");
    expect(podeSomar(escolhas, 25, "Nesquik")).toBe(true);
  });
});

describe("o que falta", () => {
  it("diz quanto falta e quantos sabores", () => {
    expect(faltaPara([{ sabor: "Ninho", unidades: 25 }], 100))
      .toBe("Faltam 75 docinhos — escolha mais 3 sabores.");
  });

  it("fala no singular quando falta um", () => {
    expect(faltaPara([{ sabor: "Ninho", unidades: 25 }], 50)).toContain("mais 1 sabor.");
  });

  it("some quando o pedido fecha", () => {
    expect(faltaPara([{ sabor: "Ninho", unidades: 100 }], 100)).toBe("");
  });
});
