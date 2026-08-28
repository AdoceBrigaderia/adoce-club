import { describe, expect, it } from "vitest";
import {
  CARIMBOS_PARA_PRESENTE,
  acaoDe,
  buscarClientes,
  carimbosNaCartela,
  confirmacaoDeCarimbo,
  legendaDe,
  simplificar,
  situacaoDe,
  ultimosAtendidos,
  type Cliente,
} from "./balcao-atendimento";

function cliente(nome: string, o: Partial<Cliente> = {}): Cliente {
  return {
    id: nome,
    nome,
    telefone: "+5585999990000",
    carimbos: 3,
    presentesGuardados: 0,
    ultimaCompra: "2026-08-01T12:00:00Z",
    ...o,
  };
}

const base = [
  cliente("Annaliza Damasceno", { telefone: "+5585992722285", carimbos: 8 }),
  cliente("Gleice Moura", { telefone: "+5585982071463", carimbos: 13 }),
  cliente("Ivone Norões", { telefone: "+5585997180030", carimbos: 14, presentesGuardados: 1 }),
  cliente("Ana Paula", { telefone: "+5585988887777", carimbos: 0, ultimaCompra: null }),
];

describe("busca no balcão", () => {
  it("acha por telefone com quatro dígitos", () => {
    expect(buscarClientes(base, "2285").map((c) => c.nome)).toEqual(["Annaliza Damasceno"]);
  });

  it("aceita telefone com parênteses e traço", () => {
    expect(buscarClientes(base, "(85) 99272-2285")[0].nome).toBe("Annaliza Damasceno");
  });

  it("acha por nome sem acento", () => {
    expect(buscarClientes(base, "noroes")[0].nome).toBe("Ivone Norões");
  });

  it("não exige a caixa certa", () => {
    expect(buscarClientes(base, "GLEICE")[0].nome).toBe("Gleice Moura");
  });

  it("quem começa com o que foi digitado vem primeiro", () => {
    const lista = [cliente("Maria Ana"), cliente("Ana Paula")];
    expect(buscarClientes(lista, "ana")[0].nome).toBe("Ana Paula");
  });

  it("não busca com menos de três letras — evita lista inútil", () => {
    expect(buscarClientes(base, "an")).toEqual([]);
  });

  it("termo vazio não devolve nada", () => {
    expect(buscarClientes(base, "   ")).toEqual([]);
  });

  it("simplificar tira acento e caixa", () => {
    expect(simplificar("Norões")).toBe("noroes");
  });
});

describe("o Clube: paga 14, a 15ª é presente", () => {
  it("na décima quarta compra a cartela fecha", () => {
    const { virouPresente, texto } = confirmacaoDeCarimbo(cliente("Gleice", { carimbos: 13 }));
    expect(virouPresente).toBe(true);
    expect(texto).toContain("próxima fatia é presente");
  });

  it("antes disso, diz quanto falta", () => {
    const { texto } = confirmacaoDeCarimbo(cliente("Annaliza", { carimbos: 8 }));
    expect(texto).toContain("a 5 fatias do presente");
  });

  it("fala no singular quando falta uma só", () => {
    const { texto } = confirmacaoDeCarimbo(cliente("Gleice", { carimbos: 12 }));
    expect(texto).toContain("a 1 fatia do presente");
  });

  it("a cartela recomeça depois do presente", () => {
    expect(carimbosNaCartela(cliente("x", { carimbos: 15 }))).toBe(1);
    expect(carimbosNaCartela(cliente("x", { carimbos: 28 }))).toBe(0);
  });

  it("o presente nunca vira desconto", () => {
    const texto = confirmacaoDeCarimbo(cliente("Gleice", { carimbos: 13 })).texto.toLowerCase();
    expect(texto).not.toContain("desconto");
    expect(texto).not.toContain("cupom");
    expect(texto).not.toContain("r$");
  });
});

describe("situação e legenda", () => {
  it("quem tem presente guardado aparece como presente", () => {
    const c = cliente("Ivone", { carimbos: 14, presentesGuardados: 1 });
    expect(situacaoDe(c)).toBe("presente");
    expect(legendaDe(c)).toBe("tem uma fatia-presente");
    expect(acaoDe(c)).toBe("Entregar");
  });

  it("dois presentes falam no plural", () => {
    expect(legendaDe(cliente("x", { presentesGuardados: 2 }))).toBe("tem 2 fatias-presente");
  });

  it("quem está a uma fatia recebe destaque", () => {
    const c = cliente("Gleice", { carimbos: 13 });
    expect(situacaoDe(c)).toBe("quase");
    expect(legendaDe(c)).toContain("falta 1 para o presente");
  });

  it("cliente novo aparece como primeira compra", () => {
    const c = cliente("Ana", { carimbos: 0 });
    expect(situacaoDe(c)).toBe("primeira");
    expect(legendaDe(c)).toBe("primeira compra");
  });

  it("no meio do caminho, mostra a conta simples", () => {
    expect(legendaDe(cliente("Annaliza", { carimbos: 8 }))).toBe(`8 de ${CARIMBOS_PARA_PRESENTE} carimbos`);
  });

  it("o botão é Carimbar para quem não tem presente", () => {
    expect(acaoDe(cliente("x", { carimbos: 3 }))).toBe("Carimbar");
  });
});

describe("últimos atendidos", () => {
  it("quem tem presente guardado sobe para o topo", () => {
    // Assim ela não precisa lembrar de conferir, e o cliente não perde
    // o presente por esquecimento da casa.
    const lista = [
      cliente("Recente", { ultimaCompra: "2026-08-08T20:00:00Z" }),
      cliente("Com presente", { ultimaCompra: "2026-07-01T10:00:00Z", presentesGuardados: 1 }),
    ];
    expect(ultimosAtendidos(lista)[0].nome).toBe("Com presente");
  });

  it("depois disso, o mais recente primeiro", () => {
    const lista = [
      cliente("Antiga", { ultimaCompra: "2026-07-01T10:00:00Z" }),
      cliente("Nova", { ultimaCompra: "2026-08-08T20:00:00Z" }),
    ];
    expect(ultimosAtendidos(lista).map((c) => c.nome)).toEqual(["Nova", "Antiga"]);
  });

  it("quem nunca comprou não entra na lista", () => {
    expect(ultimosAtendidos(base).map((c) => c.nome)).not.toContain("Ana Paula");
  });

  it("não enche a tela — a Beth reclamou de informação demais", () => {
    const muitos = Array.from({ length: 40 }, (_, i) =>
      cliente(`Cliente ${i}`, { ultimaCompra: `2026-08-0${(i % 9) + 1}T10:00:00Z` }));
    expect(ultimosAtendidos(muitos).length).toBe(6);
  });
});
