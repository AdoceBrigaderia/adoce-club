// Festas, Adoce na Escola e Decoracao — o conteudo das tres areas.
//
// Decisao do Rubens em 10/08: "enquanto a Beth nao falar que vamos encerrar
// com as Festas, Escola e Decoracao, isso precisa fazer parte" — com peso
// igual ao de Tortas e Docinhos.
//
// O que ele encontrou testando: visual destoante do resto do site e carrossel
// com falhas graves. Aqui o carrossel morre. No celular ele esconde conteudo
// atras de um gesto que ninguem faz, e quebra com facilidade — foi o que
// aconteceu.
//
// No lugar dele: uma pagina que conta a experiencia de cima para baixo. Estas
// tres linhas nao sao produto de prateleira, sao servico com data marcada.
// Quem compra precisa entender o que vai acontecer no dia.

export type Experiencia = "events" | "school" | "rentals";

export type Passo = { titulo: string; texto: string };

export type ConteudoDaExperiencia = {
  chave: Experiencia;
  titulo: string;
  /** Uma frase que diz o que a pessoa leva, nao o que a Adoce faz. */
  promessa: string;
  intro: string;
  comoFunciona: Passo[];
  /** O que a Adoce precisa saber para orcar. Curto: cada item e uma pergunta no zap. */
  precisamosSaber: string[];
  prazoDiasUteis: number;
};

export const EXPERIENCIAS: ConteudoDaExperiencia[] = [
  {
    chave: "events",
    titulo: "Festas e eventos",
    promessa: "O doce que circula pela festa e todo mundo lembra depois.",
    intro:
      "O tabuleiro passa entre os convidados e cada um monta o seu brigadeiro na hora, " +
      "do jeito que gosta. É a parte da festa em que as pessoas se levantam da mesa.",
    comoFunciona: [
      { titulo: "Você diz a data e quantas pessoas", texto: "A gente confirma se conseguimos atender e passa o valor." },
      { titulo: "Escolhemos juntos os sabores", texto: "Os granulados e as coberturas que combinam com a sua festa." },
      { titulo: "No dia, a gente chega e monta", texto: "Você não precisa se preocupar com nada além de aproveitar." },
    ],
    precisamosSaber: ["A data", "Quantos convidados", "O local", "O horário de servir"],
    prazoDiasUteis: 3,
  },
  {
    chave: "school",
    titulo: "Adoce na Escola",
    promessa: "O aniversário comemorado na sala, com a turma inteira.",
    intro:
      "A criança não perde a data e não precisa esperar a festa do fim de semana. " +
      "A gente leva tudo pronto e personalizado, no tamanho da turma.",
    comoFunciona: [
      { titulo: "Você diz a data e o tamanho da turma", texto: "Os pacotes começam em 15 crianças." },
      { titulo: "Escolhemos o tema", texto: "Personalizamos os itens com o nome e o que a criança gosta." },
      { titulo: "Entregamos pronto na escola", texto: "É só a professora abrir e servir." },
    ],
    precisamosSaber: ["A data", "Quantas crianças", "A escola", "O nome do aniversariante"],
    prazoDiasUteis: 5,
  },
  {
    chave: "rentals",
    titulo: "Decoração",
    promessa: "A mesa bonita sem você comprar nada que vai usar uma vez.",
    intro:
      "Você aluga o que precisa para montar, usa no dia e devolve. " +
      "Sai bem mais barato que comprar, e não fica guardando caixa em casa.",
    comoFunciona: [
      { titulo: "Você escolhe o kit", texto: "A gente mostra o que tem disponível para a sua data." },
      { titulo: "Retira e monta do seu jeito", texto: "Os kits são pensados para montar sem ajuda." },
      { titulo: "Devolve depois", texto: "Combinamos a devolução junto com a retirada." },
    ],
    precisamosSaber: ["A data", "Onde vai ser", "Qual kit interessou"],
    prazoDiasUteis: 3,
  },
];

export const conteudoDe = (chave: Experiencia) =>
  EXPERIENCIAS.find((e) => e.chave === chave);

/**
 * Mensagem pronta para o WhatsApp, ja com as perguntas que a Adoce precisa
 * responder para orcar. Sem link: quem esta sem dado movel nao abre, e pedir
 * isso constrange.
 */
export function mensagemDaExperiencia(chave: Experiencia, produto?: string) {
  const conteudo = conteudoDe(chave);
  if (!conteudo) return "";
  return [
    `Oi! Queria saber sobre ${produto || conteudo.titulo}.`,
    "",
    ...conteudo.precisamosSaber.map((p) => `${p}: `),
  ].join("\n");
}

/** Nenhuma destas linhas fecha sozinha no site: todas passam por conversa. */
export const exigeConversa = () => true;
