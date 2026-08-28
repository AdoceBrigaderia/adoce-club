// O balcao — as regras da tela da Beth.
//
// Ela disse, com todas as letras: "tem muita informacao na tela, e dificil de
// achar a opcao de encontrar os clientes, toda vez que entro em alguma tela da
// operacao ela abre no meio... acabo deixando pro Rubens que tem mais
// paciencia."
//
// Tela que a pessoa evita usar ja custou dinheiro. Entao aqui vale uma regra
// unica: no atendimento existem tres coisas — achar o cliente, carimbar e
// entregar o presente. Todo o resto sai da frente.
//
// O Clube: o cliente paga 14 fatias e a 15a e presente.

export const CARIMBOS_PARA_PRESENTE = 14;

export type Cliente = {
  id: string;
  nome: string;
  telefone: string;
  /** Carimbos acumulados no total, sem resetar entre cartelas. */
  carimbos: number;
  /** Presentes ja conquistados e ainda nao entregues. */
  presentesGuardados: number;
  /** Ultima vez que foi atendido, ISO. Nulo para quem nunca comprou. */
  ultimaCompra: string | null;
};

export type Situacao = "presente" | "quase" | "andando" | "primeira";

/** Remove acento e caixa, para "Anália" achar "analia". */
export function simplificar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export const soDigitos = (valor: string) => valor.replace(/\D/g, "");

/**
 * Busca por nome ou telefone, sem a pessoa precisar escolher qual.
 * Digitou numero, busca telefone. Digitou letra, busca nome.
 */
export function buscarClientes(clientes: Cliente[], termo: string) {
  const limpo = termo.trim();
  if (!limpo) return [];

  const digitos = soDigitos(limpo);
  // 4 digitos ja bastam: no balcao ninguem digita telefone inteiro.
  if (digitos.length >= 4 && digitos.length === limpo.replace(/[\s()-]/g, "").length) {
    return clientes.filter((c) => soDigitos(c.telefone).includes(digitos));
  }

  const alvo = simplificar(limpo);
  if (alvo.length < 3) return [];

  return clientes
    .filter((c) => simplificar(c.nome).includes(alvo))
    .sort((a, b) => {
      // Quem comeca com o que foi digitado vem primeiro.
      const aComeca = simplificar(a.nome).startsWith(alvo) ? 0 : 1;
      const bComeca = simplificar(b.nome).startsWith(alvo) ? 0 : 1;
      if (aComeca !== bComeca) return aComeca - bComeca;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
}

export function situacaoDe(cliente: Cliente): Situacao {
  if (cliente.presentesGuardados > 0) return "presente";
  if (cliente.carimbos === 0) return "primeira";
  const naCartela = cliente.carimbos % CARIMBOS_PARA_PRESENTE;
  if (naCartela >= CARIMBOS_PARA_PRESENTE - 1) return "quase";
  return "andando";
}

export const carimbosNaCartela = (cliente: Cliente) =>
  cliente.carimbos % CARIMBOS_PARA_PRESENTE;

/**
 * A linha de baixo do cartao. Curta: a Beth le de relance, em pe, com fila.
 */
export function legendaDe(cliente: Cliente) {
  const situacao = situacaoDe(cliente);
  if (situacao === "presente") {
    return cliente.presentesGuardados === 1
      ? "tem uma fatia-presente"
      : `tem ${cliente.presentesGuardados} fatias-presente`;
  }
  if (situacao === "primeira") return "primeira compra";
  const feitos = carimbosNaCartela(cliente);
  const faltam = CARIMBOS_PARA_PRESENTE - feitos;
  if (situacao === "quase") {
    return `${feitos} de ${CARIMBOS_PARA_PRESENTE} · falta ${faltam} para o presente`;
  }
  return `${feitos} de ${CARIMBOS_PARA_PRESENTE} carimbos`;
}

/** O que o botao faz, em uma palavra. */
export const acaoDe = (cliente: Cliente) =>
  situacaoDe(cliente) === "presente" ? "Entregar" : "Carimbar";

/**
 * Os ultimos atendidos, que aparecem sem ninguem procurar nada.
 *
 * No movimento, quase sempre e alguem que acabou de passar ou volta sempre —
 * entao na maioria das vezes ela nem digita.
 *
 * Quem tem presente guardado sobe para o topo: assim ela nao precisa lembrar
 * de conferir, e o cliente nao perde o presente por esquecimento da casa.
 */
export function ultimosAtendidos(clientes: Cliente[], quantos = 6) {
  return [...clientes]
    .filter((c) => c.ultimaCompra)
    .sort((a, b) => {
      const aPresente = a.presentesGuardados > 0 ? 0 : 1;
      const bPresente = b.presentesGuardados > 0 ? 0 : 1;
      if (aPresente !== bPresente) return aPresente - bPresente;
      return (b.ultimaCompra || "").localeCompare(a.ultimaCompra || "");
    })
    .slice(0, quantos);
}

/**
 * Confirmacao curta depois do carimbo, para ela ler sem parar o atendimento.
 * O presente e sempre presente — nunca desconto, nunca valor negativo.
 */
export function confirmacaoDeCarimbo(antes: Cliente) {
  const depois: Cliente = {
    ...antes,
    carimbos: antes.carimbos + 1,
  };
  const virouPresente =
    depois.carimbos % CARIMBOS_PARA_PRESENTE === 0 && depois.carimbos > 0;
  if (virouPresente) {
    return {
      texto: `${primeiroNome(antes.nome)} completou a cartela! A próxima fatia é presente 🎁`,
      virouPresente: true,
    };
  }
  const faltam = CARIMBOS_PARA_PRESENTE - (depois.carimbos % CARIMBOS_PARA_PRESENTE);
  return {
    texto: `Carimbo registrado. ${primeiroNome(antes.nome)} está a ${faltam} ${faltam === 1 ? "fatia" : "fatias"} do presente.`,
    virouPresente: false,
  };
}

export const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] || nome;
