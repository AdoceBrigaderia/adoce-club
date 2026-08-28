export type CommercialSegment =
  | "cakes"
  | "sweets"
  | "events"
  | "school"
  | "rentals";

export type CommercialEventSubcategory = "trays" | "mini_parties";

export type CommercialProduct = {
  id: string;
  slug: string;
  segment: CommercialSegment;
  subcategory: CommercialEventSubcategory | null;
  name: string;
  short_description: string;
  description: string;
  base_price: number | null;
  price_suffix: string;
  minimum_quantity: number;
  lead_business_days: number;
  requires_schedule: boolean;
  resource_key: string | null;
  details: {
    includes?: string[];
    rules?: string[];
    packages?: Array<{ quantity: number; price: number; flavors?: number }>;
    choices?: Record<string, string[]>;
    additional_price?: number;
  };
  image_url: string | null;
  original_image_url: string | null;
  allergens: string[];
  show_allergens: boolean;
  published: boolean;
  active: boolean;
  sort_order: number;
  meta_retailer_id: string;
  meta_product_id: string | null;
  exibir_whatsapp: boolean;
  meta_sync_status: "disabled" | "pending" | "syncing" | "submitted" | "synced" | "error";
  meta_last_sync_at: string | null;
  meta_last_error: string | null;
  meta_last_error_temporary: boolean | null;
  meta_sync_attempts: number;
  meta_payload_hash: string | null;
  meta_batch_handle: string | null;
  options?: CommercialProductOption[];
};

export type CommercialProductOption = {
  id: string;
  product_id: string;
  group_key: string;
  label: string;
  price_adjustment: number;
  active: boolean;
  sort_order: number;
};

export type ServiceRequestResult = {
  accepted: boolean;
  request_id?: string;
  request_number?: string;
  expires_at?: string;
  conflict?: "confirmed" | "prebook_limit" | "prebook_competition" | null;
  competing_prebooks?: number;
  message: string;
};

export const segmentLabels: Record<CommercialSegment, string> = {
  cakes: "Tortas",
  sweets: "Docinhos",
  events: "Eventos",
  school: "Adoce na Escola",
  rentals: "Aluguel de decoração",
};

export const eventSubcategoryLabels: Record<CommercialEventSubcategory, string> = {
  trays: "Tabuleiro",
  mini_parties: "Mini Festas",
};

export function money(value: number | null) {
  if (value === null) return "Valor sob consulta";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

const cakeStartingPriceSlugs = new Set(["torta-p", "torta-m", "torta-g"]);

export function commercialProductPriceLabel(
  product: Pick<CommercialProduct, "slug" | "base_price" | "price_suffix">,
) {
  const showsStartingPrice = cakeStartingPriceSlugs.has(product.slug)
    || product.price_suffix.trim().toLocaleLowerCase("pt-BR") === "a partir de";

  return `${showsStartingPrice ? "A partir de " : ""}${money(product.base_price)}`;
}

export function businessDateAfter(start: Date, days: number) {
  const result = new Date(start);
  result.setHours(12, 0, 0, 0);
  let remaining = Math.max(0, days);
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const weekday = result.getDay();
    if (weekday !== 0 && weekday !== 6) remaining -= 1;
  }
  return result.toISOString().slice(0, 10);
}

export function formatCommercialDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${value}T12:00:00`));
}

export function leadTimeMessage(businessDays: number, minimumDate: string) {
  const days = businessDays === 1 ? "1 dia útil" : `${businessDays} dias úteis`;
  return `Para prepararmos tudo com carinho, precisamos de ${days} de antecedência. A primeira data disponível para esta opção é ${formatCommercialDate(minimumDate)}.`;
}

export type CommercialRequestField = "name" | "phone" | "email" | "quantity" | "date" | "time" | "privacy";

export type CommercialRequestDraft = {
  name: string;
  phone: string;
  email: string;
  quantity: number;
  date: string;
  time: string;
  privacy: boolean;
};

export type PreorderBusinessHour = {
  channel_slug: string;
  weekday: number;
  opens_at: string;
  closes_at: string;
  active: boolean;
};

export type PreorderBusinessHourException = {
  channel_slug: string;
  service_date: string;
  closed: boolean;
  opens_at: string | null;
  closes_at: string | null;
};

const minutesOf = (value: string) => {
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
};

export function validatePreorderWindow(date: string, time: string, hours: PreorderBusinessHour[], exceptions: PreorderBusinessHourException[]) {
  if (!date || !time) return "";
  if (!hours.length) return "Não foi possível confirmar o horário da loja. Atualize a página antes de reservar.";
  const exception = exceptions.find((item) => item.channel_slug === "preorders" && item.service_date === date);
  if (exception?.closed) return "A Adoce não recebe pré-encomendas nesta data.";
  const windows = exception?.opens_at && exception.closes_at
    ? [{ opens_at: exception.opens_at, closes_at: exception.closes_at }]
    : hours.filter((item) => item.active && item.channel_slug === "preorders" && item.weekday === new Date(`${date}T12:00:00`).getDay());
  const requested = minutesOf(time);
  if (windows.some((item) => requested >= minutesOf(item.opens_at) && requested <= minutesOf(item.closes_at))) return "";
  if (!windows.length) return "A Adoce não recebe pré-encomendas neste dia da semana.";
  const ranges = windows.map((item) => `${item.opens_at.slice(0, 5)}–${item.closes_at.slice(0, 5)}`).join(" ou ");
  return `Escolha um horário de pré-encomenda entre ${ranges}.`;
}

export function validateCommercialRequest(
  draft: CommercialRequestDraft,
  minimumQuantity: number,
  minimumDate: string,
  leadBusinessDays: number,
  schedule?: { hours: PreorderBusinessHour[]; exceptions: PreorderBusinessHourException[] },
) {
  const errors: Partial<Record<CommercialRequestField, string>> = {};
  if (draft.name.trim().split(/\s+/).filter((part) => part.length >= 2).length < 2) errors.name = "Informe nome e sobrenome separados por espaço.";
  if (draft.name.trim().length < 2) errors.name = "Conte como podemos chamar você.";
  const phone = normalizeBrazilianPhone(draft.phone);
  if (phone.length < 12 || phone.length > 13) errors.phone = "Informe um WhatsApp válido com DDD para falarmos sobre a encomenda.";
  if (draft.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) errors.email = "Confira o e-mail ou deixe este campo vazio.";
  if (!Number.isFinite(draft.quantity) || draft.quantity < minimumQuantity) errors.quantity = `Esta opção começa com ${minimumQuantity} unidade(s).`;
  if (!draft.date) errors.date = "Escolha a data em que deseja receber sua encomenda.";
  else if (draft.date < minimumDate) errors.date = leadTimeMessage(leadBusinessDays, minimumDate);
  if (!draft.time) errors.time = "Escolha o horário desejado.";
  if (!draft.privacy) errors.privacy = "Confirme a Política de Privacidade para enviarmos sua solicitação.";
  if (schedule && draft.date && draft.time) {
    const scheduleError = validatePreorderWindow(draft.date, draft.time, schedule.hours, schedule.exceptions);
    if (scheduleError) errors.time = scheduleError;
  }
  return errors;
}

export function normalizeBrazilianPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export function commercialWhatsAppMessage(
  product: CommercialProduct,
  requestNumber?: string,
) {
  const reference = requestNumber ? ` Minha solicitação é ${requestNumber}.` : "";
  return `Olá, Elizabeth! Quero falar sobre ${product.name}.${reference}`;
}
