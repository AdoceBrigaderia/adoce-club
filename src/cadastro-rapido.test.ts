import { describe, expect, it } from "vitest";
import {
  FRASE_DE_CONSENTIMENTO,
  arrumarNome,
  digitosDoTelefone,
  jaExiste,
  mascaraTelefone,
  paraEnvio,
  podeSalvar,
  telefoneE164,
  validar,
} from "./cadastro-rapido";

describe("telefone", () => {
  it("guarda só dígitos", () => {
    expect(digitosDoTelefone("(85) 99272-2285")).toBe("85992722285");
  });

  it("descarta o 55 quando vem colado", () => {
    expect(digitosDoTelefone("+55 85 99272-2285")).toBe("85992722285");
  });

  it("vai formatando enquanto digita", () => {
    expect(mascaraTelefone("85")).toBe("85");
    expect(mascaraTelefone("8599")).toBe("(85) 99");
    expect(mascaraTelefone("859927222")).toBe("(85) 9927-222");
    expect(mascaraTelefone("8532001234")).toBe("(85) 3200-1234");
    expect(mascaraTelefone("85992722285")).toBe("(85) 99272-2285");
  });

  it("não deixa passar de onze dígitos", () => {
    expect(mascaraTelefone("859927222859999")).toBe("(85) 99272-2285");
  });

  it("monta o formato que o banco espera", () => {
    expect(telefoneE164("(85) 99272-2285")).toBe("+5585992722285");
  });

  it("não monta telefone incompleto", () => {
    expect(telefoneE164("8599")).toBe("");
  });
});

describe("nome", () => {
  it("arruma o que foi digitado com pressa", () => {
    expect(arrumarNome("  maria   souza ")).toBe("Maria Souza");
  });

  it("mantém as partículas minúsculas, como se escreve nome de gente", () => {
    expect(arrumarNome("MARIA DE SOUZA")).toBe("Maria de Souza");
    expect(arrumarNome("joao dos santos")).toBe("Joao dos Santos");
  });

  it("não minúscula a primeira palavra, mesmo sendo partícula", () => {
    expect(arrumarNome("da silva costa")).toBe("Da Silva Costa");
  });
});

describe("o que trava o cadastro", () => {
  // A migração require_customer_first_and_last_name, de 22/07, exige os dois.
  it("exige sobrenome", () => {
    const p = validar({ nome: "Maria", telefone: "85992722285" });
    expect(p).toEqual([{ campo: "nome", texto: "Falta o sobrenome." }]);
  });

  it("avisa quando falta o telefone", () => {
    expect(validar({ nome: "Maria Souza", telefone: "" })[0].texto).toBe("Falta o WhatsApp.");
  });

  it("avisa quando o telefone está pela metade", () => {
    expect(validar({ nome: "Maria Souza", telefone: "8599" })[0].texto).toContain("Faltam números");
  });

  it("desconfia de celular sem o 9", () => {
    const p = validar({ nome: "Maria Souza", telefone: "85812345678" });
    expect(p[0].texto).toContain("começa com 9");
  });

  it("aceita telefone fixo de dez dígitos", () => {
    expect(validar({ nome: "Maria Souza", telefone: "8532001234" })).toEqual([]);
  });

  it("com nome e WhatsApp certos, salva", () => {
    expect(podeSalvar({ nome: "Annaliza Damasceno", telefone: "(85) 99272-2285" })).toBe(true);
  });

  it("as mensagens são curtas — é para ler de relance, com fila", () => {
    for (const problema of validar({ nome: "M", telefone: "8" })) {
      expect(problema.texto.length).toBeLessThan(45);
    }
  });
});

describe("cliente repetido", () => {
  const clientes = [{ telefone: "+5585992722285", nome: "Annaliza Damasceno" }];

  it("encontra pelo telefone, em qualquer formato", () => {
    expect(jaExiste(clientes, "(85) 99272-2285")?.nome).toBe("Annaliza Damasceno");
    expect(jaExiste(clientes, "85992722285")?.nome).toBe("Annaliza Damasceno");
  });

  it("não confunde com telefone diferente", () => {
    expect(jaExiste(clientes, "85999998888")).toBeNull();
  });

  it("não arrisca palpite com telefone incompleto", () => {
    expect(jaExiste(clientes, "8599")).toBeNull();
  });
});

describe("envio", () => {
  it("manda nome arrumado e telefone no formato do banco", () => {
    expect(paraEnvio({ nome: "  annaliza damasceno ", telefone: "(85) 99272-2285" }))
      .toEqual({ nome: "Annaliza Damasceno", telefone: "+5585992722285" });
  });
});

describe("consentimento", () => {
  it("é uma pergunta falada, curta, e diz para que serve", () => {
    expect(FRASE_DE_CONSENTIMENTO).toContain("carimbos");
    expect(FRASE_DE_CONSENTIMENTO).toContain("avisar");
    expect(FRASE_DE_CONSENTIMENTO.length).toBeLessThan(120);
    expect(FRASE_DE_CONSENTIMENTO.trim().endsWith("?")).toBe(true);
  });
});
