export type BotFlavor = {
  id: string;
  name: string;
  price: number;
  free: number;
};

export type BotSelection = BotFlavor & { quantity: number };
export type BotOption = { code: string; label: string };

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const normalizeCommand = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

export const isFullName = (value: string) =>
  value.trim().length <= 140 &&
  value.trim().split(/\s+/).filter((part) => part.replace(/[^\p{L}]/gu, "").length >= 2).length >= 2;

export function parseItemSelection(value: string, flavors: BotFlavor[]) {
  const cleaned = normalizeCommand(value);
  const parts = cleaned.split(/[,;\n]+/).map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return { error: "Escolha um sabor pelo número." } as const;

  const quantities = new Map<number, number>();
  for (const part of parts) {
    const match = part.match(/^(\d{1,2})(?:\s*[x*]\s*(\d{1,2}))?$/);
    if (!match) return { error: `Não entendi "${part}". Escolha pelo número.` } as const;
    const index = Number(match[1]);
    const quantity = Number(match[2] || "1");
    if (!flavors[index - 1] || quantity < 1)
      return { error: `A opção ${index} não está disponível.` } as const;
    quantities.set(index, (quantities.get(index) || 0) + quantity);
  }

  const selections: BotSelection[] = [];
  for (const [index, quantity] of quantities) {
    const flavor = flavors[index - 1];
    if (quantity > flavor.free)
      return { error: `${flavor.name}: há ${flavor.free} unidade(s) disponível(is).` } as const;
    selections.push({ ...flavor, quantity });
  }
  const totalQuantity = selections.reduce((sum, item) => sum + item.quantity, 0);
  if (totalQuantity > 30) return { error: "O pedido aceita no máximo 30 fatias." } as const;
  return { selections } as const;
}

export function parseOption(value: string, options: BotOption[]) {
  const index = Number(normalizeCommand(value));
  if (!Number.isInteger(index) || index < 1 || index > options.length) return null;
  return options[index - 1];
}

// Entrega da Adoce só a partir deste total de fatias. Abaixo disso o cliente
// retira no local ou manda um entregador de aplicativo coletar — sempre depois
// que a loja avisa que o pedido está separado. O cliente NÃO informa horário
// nem quem retira: é só um aviso.
export const DELIVERY_MIN_SLICES = 5;

export const deliveryNoticeMessage = (totalSlices: number) =>
  (totalSlices >= DELIVERY_MIN_SLICES
    ? [
        "Sobre a retirada:",
        "",
        `Como seu pedido tem ${totalSlices} fatias, ele pode ser entregue pela Adoce.`,
        "Combinamos a entrega com você por aqui assim que o pedido estiver separado.",
        "Se preferir, você também pode retirar no local ou enviar um entregador de aplicativo.",
      ]
    : [
        "Sobre a retirada:",
        "",
        `A entrega da Adoce é só para pedidos de ${DELIVERY_MIN_SLICES} fatias ou mais.`,
        "Para este pedido, você retira no local ou envia um entregador de aplicativo para coletar,",
        "depois que avisarmos aqui que o pedido está separado.",
      ]
  ).join("\n");

export const mainMenuMessage = () => [
  "Olá! Eu sou o atendimento automático da Adoce.",
  "",
  "Escolha uma das opções abaixo e responda com o número da opção desejada:",
  "",
  "1. Ver o cardápio do Festival de Fatias e fazer pedido",
  "2. Falar com a equipe sobre o Festival de Fatias",
  "3. Realizar orçamento",
].join("\n");

export const emptyFestivalMenuMessage = () => [
  "Não há fatias disponíveis para pedido automático agora.",
  "",
  "1. Falar com a equipe sobre o Festival de Fatias",
  "2. Voltar ao menu principal",
  "",
  "Responda com o número da opção desejada.",
].join("\n");

export const MAX_SLICES_PER_FLAVOR = 13;

export const catalogMessage = (flavors: BotFlavor[], selections: BotSelection[] = []) => {
  const subtotal = selections.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const selected = selections.length
    ? [
        "Seu pedido até agora:",
        ...selections.map((item) => `• ${item.quantity}x ${item.name} — ${money(item.price * item.quantity)}`),
        `Subtotal: ${money(subtotal)}`,
        "",
      ]
    : [];
  const actions = [
    `${flavors.length + 1}. Concluir a escolha${selections.length ? " e continuar" : ""}`,
    `${flavors.length + 2}. Cancelar pedido`,
    `${flavors.length + 3}. Falar com a equipe`,
  ];
  if (selections.length) actions.push(`${flavors.length + 4}. Remover um item do pedido`);
  return [
    "Escolha um sabor pelo número:",
    "",
    ...flavors.map((flavor, index) =>
      flavor.free > 0
        ? `${index + 1}. ${flavor.name} — ${money(flavor.price)} (${flavor.free} disponíve${flavor.free === 1 ? "l" : "is"})`
        : `${index + 1}. ${flavor.name} — esgotado`,
    ),
    "",
    ...actions,
    "",
    ...selected,
    "Responda somente com o número da opção.",
  ].join("\n");
};

export const quantityMessage = (flavor: BotFlavor, maximum: number) => [
  `Quantas fatias de *${flavor.name}* você deseja?`,
  ...(maximum < MAX_SLICES_PER_FLAVOR
    ? ["", `Máximo disponível agora: ${maximum} fatia${maximum === 1 ? "" : "s"} deste sabor.`]
    : []),
  "",
  ...Array.from({ length: maximum }, (_, index) =>
    `${index + 1}. ${index + 1} fatia${index ? "s" : ""}`,
  ),
  `${maximum + 1}. Voltar aos sabores`,
  "",
  "Responda somente com o número da opção.",
].join("\n");

export const removeItemMessage = (selections: BotSelection[]) => [
  "Qual item remover do pedido?",
  "",
  ...selections.map((item, index) => `${index + 1}. ${item.quantity}x ${item.name}`),
  `${selections.length + 1}. Voltar sem remover`,
  "",
  "Responda somente com o número da opção.",
].join("\n");

export const optionsMessage = (title: string, options: BotOption[], withBack = false) =>
  [
    title,
    "",
    ...options.map((option, index) => `${index + 1}. ${option.label}`),
    ...(withBack ? ["0. Voltar"] : []),
    "",
    "Responda somente com o número da opção.",
  ].join("\n");

export const sauceModeMessage = (totalSlices: number) => [
  `Você quer a mesma calda para todas as ${totalSlices} fatias?`,
  "",
  "1. Sim, mesma calda para todas",
  "2. Quero escolher a calda de cada fatia",
  "0. Voltar",
  "",
  "Responda somente com o número da opção.",
].join("\n");

export const sliceSauceMessage = (
  position: number,
  total: number,
  flavorName: string,
  sauces: BotOption[],
) => [
  `Calda da fatia ${position} de ${total} — *${flavorName}*:`,
  "",
  ...sauces.map((option, index) => `${index + 1}. ${option.label}`),
  "0. Voltar",
  "",
  "Responda somente com o número da opção.",
].join("\n");

export { pixInstructions as pixMessage } from "../../../src/pix-payment";

export function orderSummary(input: {
  name: string;
  selections: BotSelection[];
  sauceLabel: string;
  paymentLabel: string;
}) {
  const total = input.selections.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return [
    "Confira seu pedido:",
    "",
    ...input.selections.map((item) => `${item.quantity}x ${item.name}`),
    `Calda: ${input.sauceLabel}`,
    `Pagamento: ${input.paymentLabel}`,
    `Total estimado: ${money(total)}`,
    "",
    "1. Registrar pedido",
    "2. Cancelar pedido",
    "",
    "Responda somente com o número da opção.",
    "A cobrança só acontece depois da confirmação da Adoce.",
  ].join("\n");
}

export const xmlEscape = (value: string) => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&apos;");

export const twiml = (message = "") =>
  message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${xmlEscape(message)}</Message></Response>`
    : '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
