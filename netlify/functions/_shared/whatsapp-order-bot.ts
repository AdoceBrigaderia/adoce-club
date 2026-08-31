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
  if (!parts.length) return { error: "Informe os itens no formato 1x2, 3x1." } as const;

  const quantities = new Map<number, number>();
  for (const part of parts) {
    const match = part.match(/^(\d{1,2})(?:\s*[x*]\s*(\d{1,2}))?$/);
    if (!match) return { error: `NÃ£o entendi "${part}". Use, por exemplo: 1x2, 3x1.` } as const;
    const index = Number(match[1]);
    const quantity = Number(match[2] || "1");
    if (!flavors[index - 1] || quantity < 1)
      return { error: `A opÃ§Ã£o ${index} nÃ£o estÃ¡ disponÃ­vel.` } as const;
    quantities.set(index, (quantities.get(index) || 0) + quantity);
  }

  const selections: BotSelection[] = [];
  for (const [index, quantity] of quantities) {
    const flavor = flavors[index - 1];
    if (quantity > flavor.free)
      return { error: `${flavor.name}: hÃ¡ ${flavor.free} unidade(s) disponÃ­vel(is).` } as const;
    selections.push({ ...flavor, quantity });
  }
  const totalQuantity = selections.reduce((sum, item) => sum + item.quantity, 0);
  if (totalQuantity > 30) return { error: "O pedido aceita no mÃ¡ximo 30 fatias." } as const;
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

export const catalogMessage = (flavors: BotFlavor[]) =>
  [
    "Oi! Eu sou o atendimento automÃ¡tico da Adoce. Vou montar seu pedido de fatias para retirada. ðŸ°",
    "",
    ...flavors.map((flavor, index) =>
      `${index + 1}. ${flavor.name} â€” ${money(flavor.price)} (${flavor.free} disponÃ­vel${flavor.free === 1 ? "" : "is"})`,
    ),
    "",
    "Responda no formato *nÃºmero x quantidade*.",
    "Exemplo: *1x2, 3x1*",
    "",
    "A qualquer momento: *MENU*, *CANCELAR* ou *ATENDENTE*.",
  ].join("\n");

export const optionsMessage = (title: string, options: BotOption[]) =>
  [title, "", ...options.map((option, index) => `${index + 1}. ${option.label}`)].join("\n");

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
    `Retirada: ${input.pickupMethod === "driver" ? "entregador de aplicativo" : input.name}, Ã s ${input.pickupTime}`,
    `Total estimado: ${money(total)}`,
    "",
    "Responda *SIM* para registrar ou *CANCELAR*.",
    "A cobranÃ§a sÃ³ acontece depois da confirmaÃ§Ã£o da Adoce.",
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
