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

export function pickupTimeOptions(minimum: string, limit = 10) {
  const [hour, minute] = minimum.slice(0, 5).split(":").map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return [];
  let totalMinutes = Math.ceil((hour * 60 + minute) / 30) * 30;
  const options: string[] = [];
  while (totalMinutes <= 23 * 60 + 30 && options.length < limit) {
    const optionHour = Math.floor(totalMinutes / 60);
    const optionMinute = totalMinutes % 60;
    options.push(`${String(optionHour).padStart(2, "0")}:${String(optionMinute).padStart(2, "0")}`);
    totalMinutes += 30;
  }
  return options;
}

export const mainMenuMessage = () => [
  "Olá! Eu sou o atendimento automático da Adoce. 🍰",
  "",
  "Para abrir o cardápio, responda somente com o número da opção:",
  "",
  "1. Ver cardápio e fazer pedido",
  "2. Falar com a equipe da Adoce",
].join("\n");

export const catalogMessage = (flavors: BotFlavor[], selections: BotSelection[] = []) => {
  const selected = selections.length
    ? ["Seu pedido até agora:", ...selections.map((item) => `• ${item.quantity}x ${item.name}`), ""]
    : [];
  return [
    "Escolha um sabor pelo número:",
    "",
    ...flavors.map((flavor, index) =>
      `${index + 1}. ${flavor.name} — ${money(flavor.price)} (${flavor.free} disponível${flavor.free === 1 ? "" : "is"})`,
    ),
    "",
    `${flavors.length + 1}. Concluir a escolha${selections.length ? " e continuar" : ""}`,
    `${flavors.length + 2}. Cancelar pedido`,
    `${flavors.length + 3}. Falar com a equipe`,
    "",
    ...selected,
    "Responda somente com o número da opção.",
  ].join("\n");
};

export const quantityMessage = (flavor: BotFlavor, maximum: number) => [
  `Quantas fatias de *${flavor.name}* você deseja?`,
  "",
  ...Array.from({ length: maximum }, (_, index) =>
    `${index + 1}. ${index + 1} fatia${index ? "s" : ""}`,
  ),
  `${maximum + 1}. Voltar aos sabores`,
  "",
  "Responda somente com o número da opção.",
].join("\n");

export const optionsMessage = (title: string, options: BotOption[]) =>
  [title, "", ...options.map((option, index) => `${index + 1}. ${option.label}`), "", "Responda somente com o número da opção."].join("\n");

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
