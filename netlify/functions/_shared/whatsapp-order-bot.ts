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

export function parsePickupTime(value: string, currentTime: string) {
  const match = value.trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  const time = `${match[1]}:${match[2]}`;
  return time >= currentTime ? time : null;
}

export const PICKUP_OPENING = "20:00";
export const PICKUP_CLOSING = "23:00";

export function pickupTimeOptions(minimum: string, limit = 10) {
  const [hour, minute] = minimum.slice(0, 5).split(":").map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return [];
  let totalMinutes = Math.ceil((hour * 60 + minute) / 30) * 30;
  const options: string[] = [];
  const [closeHour, closeMinute] = PICKUP_CLOSING.split(":").map(Number);
  const closingMinutes = closeHour * 60 + closeMinute;
  while (totalMinutes <= closingMinutes && options.length < limit) {
    const optionHour = Math.floor(totalMinutes / 60);
    const optionMinute = totalMinutes % 60;
    options.push(`${String(optionHour).padStart(2, "0")}:${String(optionMinute).padStart(2, "0")}`);
    totalMinutes += 30;
  }
  return options;
}

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

export const pixMessage = () => [
  "Pagamento somente via Pix.",
  "",
  "Chave (e-mail): pagamento@adocebrigaderia.com.br",
  "Favorecido: Elizabeth Cristina Sampaio Nascimento",
  "Banco: Mercado Pago",
  "",
  "O pagamento é confirmado pela equipe da Adoce aqui pelo WhatsApp. Nenhuma cobrança acontece antes disso.",
].join("\n");

export const driverAddressMessage = (customerName: string) => [
  "Para o motorista chegar até nós:",
  "",
  "• Uber, Google Maps ou Waze: busque *Cantinho da Adoce*",
  "• 99: ainda não aparece pelo nome — use o endereço *Rua Cento Quatro, 277 – Passaré*",
  "",
  `Peça a corrida com coleta nesse endereço, em nome de *${customerName}*.`,
  "Quando o motorista estiver a caminho, avise por aqui.",
].join("\n");

export const pickupTimesMessage = (options: string[]) =>
  optionsMessage("Escolha o horário da retirada:", options.map((time) => ({ code: time, label: time })));

export function orderSummary(input: {
  name: string;
  selections: BotSelection[];
  sauceLabel: string;
  paymentLabel: string;
  pickupMethod: "customer" | "driver";
  pickupTime: string;
}) {
  const total = input.selections.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return [
    "Confira seu pedido:",
    "",
    ...input.selections.map((item) => `${item.quantity}x ${item.name}`),
    `Calda: ${input.sauceLabel}`,
    `Pagamento: ${input.paymentLabel}`,
    `Retirada: ${input.pickupMethod === "driver" ? "entregador de aplicativo" : input.name}, às ${input.pickupTime}`,
    `Total estimado: ${money(total)}`,
    "",
    "1. Registrar pedido",
    "2. Escolher outro horário",
    "3. Cancelar pedido",
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
