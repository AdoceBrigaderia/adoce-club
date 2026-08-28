// Cadastro de cliente no balcao, em dez segundos.
//
// Nasceu de uma descoberta do Rubens conversando com os proprios clientes:
// muitos so tem WhatsApp e Instagram gratuitos no plano, e abrir o site custa
// dado pago. Eles nao dizem isso — dizem "depois eu vejo". O constrangimento
// vira desculpa educada, e o cadastro nao acontece.
//
// Conclusao de projeto: o cadastro sai do celular do cliente e vai para o
// aparelho da Adoce. Ele so fala o nome e o telefone. Nao abre nada, nao
// instala nada, nao mostra a ninguem que esta sem internet.
//
// Dois campos. Nada mais entra aqui sem justificativa forte.

export type Rascunho = {
  nome: string;
  telefone: string;
};

export type Problema = {
  campo: "nome" | "telefone";
  texto: string;
};

/** Guarda so digitos e ja descarta o 55 do pais quando vier junto. */
export function digitosDoTelefone(valor: string) {
  const so = valor.replace(/\D/g, "");
  if (so.length > 11 && so.startsWith("55")) return so.slice(2);
  return so;
}

/** (85) 99999-9999 enquanto a pessoa digita. */
export function mascaraTelefone(valor: string) {
  const d = digitosDoTelefone(valor).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function telefoneE164(valor: string) {
  const d = digitosDoTelefone(valor);
  return d.length >= 10 ? `+55${d}` : "";
}

/**
 * "maria  DE souza" vira "Maria de Souza".
 * As particulas ficam minusculas, como se escreve nome de gente.
 */
const PARTICULAS = new Set(["de", "da", "do", "das", "dos", "e"]);

export function arrumarNome(valor: string) {
  return valor
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .split(" ")
    .map((parte, indice) =>
      indice > 0 && PARTICULAS.has(parte)
        ? parte
        : parte.charAt(0).toUpperCase() + parte.slice(1),
    )
    .join(" ");
}

/**
 * O banco exige nome e sobrenome desde 22/07 — a migracao
 * require_customer_first_and_last_name. Validar aqui evita o cliente
 * esperando enquanto o erro volta do servidor.
 */
export function validar(rascunho: Rascunho): Problema[] {
  const problemas: Problema[] = [];
  const nome = rascunho.nome.trim().replace(/\s+/g, " ");
  const partes = nome.split(" ").filter((p) => p.length > 1);

  if (nome.length < 3) {
    problemas.push({ campo: "nome", texto: "Escreva o nome do cliente." });
  } else if (partes.length < 2) {
    problemas.push({ campo: "nome", texto: "Falta o sobrenome." });
  }

  const d = digitosDoTelefone(rascunho.telefone);
  if (d.length === 0) {
    problemas.push({ campo: "telefone", texto: "Falta o WhatsApp." });
  } else if (d.length < 10) {
    problemas.push({ campo: "telefone", texto: "Faltam números — com DDD." });
  } else if (d.length === 11 && d[2] !== "9") {
    problemas.push({ campo: "telefone", texto: "Confira: celular começa com 9 depois do DDD." });
  }

  return problemas;
}

export const podeSalvar = (rascunho: Rascunho) => validar(rascunho).length === 0;

/**
 * Antes de criar, procurar. Cliente cadastrado duas vezes perde carimbo, e
 * carimbo perdido e a unica coisa que o cartao de papel nunca fazia.
 */
export function jaExiste<T extends { telefone: string }>(
  clientes: T[],
  telefone: string,
) {
  const d = digitosDoTelefone(telefone);
  if (d.length < 10) return null;
  return clientes.find((c) => digitosDoTelefone(c.telefone) === d) || null;
}

export function paraEnvio(rascunho: Rascunho) {
  return {
    nome: arrumarNome(rascunho.nome),
    telefone: telefoneE164(rascunho.telefone),
  };
}

/**
 * O que a Adoce diz em voz alta antes de cadastrar. Curto de proposito: e para
 * ser falado no balcao, nao lido numa tela pelo cliente.
 */
export const FRASE_DE_CONSENTIMENTO =
  "Posso anotar seu nome e WhatsApp para guardar seus carimbos e avisar quando seu sabor voltar?";
