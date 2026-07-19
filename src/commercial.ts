export type CommercialSegment =
  | "cakes"
  | "sweets"
  | "events"
  | "school"
  | "rentals";

export type CommercialProduct = {
  id: string;
  slug: string;
  segment: CommercialSegment;
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
  allergens: string[];
  show_allergens: boolean;
  published: boolean;
  active: boolean;
  sort_order: number;
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
  rentals: "Acervo",
};

export function money(value: number | null) {
  if (value === null) return "Valor sob consulta";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
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
