import { getBffSession, readBffCsrfToken } from "./bff-auth";

export type PublicOrderSauce = { id: string; name: string };
export type PublicCheckoutPaymentMethod = { code: string; label: string };
export type PublicInstantOrderItem = {
  flavor_id: string;
  quantity: number;
  sauces?: Array<{ unit_number: number; sauce_id: string | null }>;
};
export type PublicInstantOrderReward = {
  flavor_id: string;
  sauce_id: string | null;
};
export type PublicInstantOrderQuote = {
  quantity: number;
  subtotal: number;
  standard_slice_price: number;
  reward_upgrade: number;
  total: number;
  server_calculated: true;
  items: Array<{
    flavor_id: string;
    flavor_name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
};
export type PublicInstantOrderLoyaltyPreview = {
  recognized: boolean;
  current_progress?: number;
  purchase_quantity?: number;
  projected_progress?: number;
  projected_new_rewards?: number;
  available_rewards?: number;
  reward_choices?: number;
  will_unlock_reward?: boolean;
};

export type PublicInstantOrderSubmission = {
  accepted: boolean;
  idempotent?: boolean;
  order_number?: string;
  token?: string;
  status?: string;
  checkout_mode?: "automatic" | "staff_confirmation";
  subtotal?: number;
  total?: number;
  gross_amount?: number;
  payment_fee_amount?: number;
  net_amount?: number;
  payment_method?: string;
  payment_method_label?: string;
  reserved_until?: string | null;
  pickup_label?: string;
  pickup_address?: string;
  reward_requested?: boolean;
  reward_flavor_name?: string;
  reward_sauce_name?: string;
  reward_upgrade?: number;
  offer_club_invite?: boolean;
  server_calculated?: boolean;
  message: string;
};

type Envelope<T> = { data?: T; error?: string; code?: string };
type Action = "options" | "loyalty_preview" | "quote" | "submit";

async function parse<T>(response: Response) {
  const body = (await response.json().catch(() => ({}))) as Envelope<T>;
  if (!response.ok) {
    const error = new Error(
      body.error || "Não foi possível concluir o pedido.",
    ) as Error & { code?: string; status?: number };
    error.code = body.code;
    error.status = response.status;
    throw error;
  }
  return body.data as T;
}

async function request<T>(action: Action, payload: Record<string, unknown>) {
  const csrfToken = readBffCsrfToken();
  return fetch("/api/public-instant-order", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
    },
    body: JSON.stringify({ action, ...payload }),
  });
}

async function call<T>(
  action: Action,
  payload: Record<string, unknown> = {},
  retrySession = true,
): Promise<T> {
  const first = await request<T>(action, payload);
  if (first.ok) return parse<T>(first);

  const failure = (await first.json().catch(() => ({}))) as Envelope<T>;
  if (
    !retrySession ||
    first.status !== 401 ||
    failure.code !== "session_refresh_required"
  ) {
    const error = new Error(
      failure.error || "Não foi possível concluir o pedido.",
    ) as Error & { code?: string; status?: number };
    error.code = failure.code;
    error.status = first.status;
    throw error;
  }

  const session = await getBffSession();
  if (!session || session.user.surface !== "client") {
    throw new Error("Sua sessão do Clube expirou. Entre novamente.");
  }
  return parse<T>(await request<T>(action, payload));
}

export function loadPublicInstantOrderOptions() {
  return call<{
    sauces: PublicOrderSauce[];
    paymentMethods: PublicCheckoutPaymentMethod[];
  }>("options", {}, false);
}

export function previewPublicInstantOrderLoyalty(input: {
  phone: string;
  quantity: number;
}) {
  return call<PublicInstantOrderLoyaltyPreview>("loyalty_preview", {
    requested_phone: input.phone,
    requested_quantity: input.quantity,
  });
}

export function quotePublicInstantOrder(input: {
  items: PublicInstantOrderItem[];
  reward?: PublicInstantOrderReward | null;
}) {
  return call<PublicInstantOrderQuote>("quote", {
    requested_items: input.items,
    requested_reward: input.reward || null,
  });
}

export function submitPublicInstantOrder(input: {
  customerName: string;
  customerPhone: string;
  items: PublicInstantOrderItem[];
  notes?: string;
  paymentMethod: string;
  reward?: PublicInstantOrderReward | null;
}) {
  const operationKey = crypto.randomUUID();
  return call<PublicInstantOrderSubmission>("submit", {
    requested_operation_key: operationKey,
    requested_customer_name: input.customerName,
    requested_customer_phone: input.customerPhone,
    requested_items: input.items,
    requested_notes: input.notes || "",
    requested_payment_method: input.paymentMethod,
    requested_reward: input.reward || null,
  });
}
