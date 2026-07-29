export type NullableNumber = number | null;

export type OrdersByChannelRow = {
  channel: string;
  orders: number;
  gross: NullableNumber;
  net: NullableNumber;
};

export type SalesByCashRegisterRow = {
  store_id: string;
  store_name: string;
  register_id: string;
  register_name: string;
  finance_authorized: boolean;
  orders: number;
  gross: NullableNumber;
  net: NullableNumber;
};

export type SalesByOperatorRow = {
  store_id: string;
  store_name: string;
  operator_user_id: string | null;
  operator_name: string;
  finance_authorized: boolean;
  orders: number;
  gross: NullableNumber;
};

export type CashSessionsByRegisterRow = {
  store_id: string;
  store_name: string;
  register_id: string;
  register_name: string;
  finance_authorized: boolean;
  sessions: number;
  open_sessions: number;
  closed_sessions: number;
  divergent_sessions: NullableNumber;
  absolute_difference: NullableNumber;
};

export type OperationalReportBreakdownPayload = {
  orders_by_channel?: unknown;
  sales_by_cash_register?: unknown;
  sales_by_operator?: unknown;
  cash_sessions_by_register?: unknown;
};

export type OperationalReportBreakdowns = {
  ordersByChannel: OrdersByChannelRow[];
  salesByCashRegister: SalesByCashRegisterRow[];
  salesByOperator: SalesByOperatorRow[];
  cashSessionsByRegister: CashSessionsByRegisterRow[];
};

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};

const asRows = (value: unknown): UnknownRecord[] =>
  Array.isArray(value) ? value.map(asRecord) : [];

const text = (value: unknown, fallback = "") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const count = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
};

const nullableAmount = (value: unknown): NullableNumber => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const boolean = (value: unknown) => value === true || value === "true";

export const channelLabel = (channel: string) =>
  ({
    online: "On-line",
    presencial: "Presencial",
  })[channel] || channel || "Canal não informado";

export const normalizeOperationalReportBreakdowns = (
  payload: OperationalReportBreakdownPayload,
): OperationalReportBreakdowns => ({
  ordersByChannel: asRows(payload.orders_by_channel).map((row) => ({
    channel: text(row.channel, "unknown"),
    orders: count(row.orders),
    gross: nullableAmount(row.gross),
    net: nullableAmount(row.net),
  })),
  salesByCashRegister: asRows(payload.sales_by_cash_register).map((row) => ({
    store_id: text(row.store_id),
    store_name: text(row.store_name, "Loja não identificada"),
    register_id: text(row.register_id),
    register_name: text(row.register_name, "Caixa não identificado"),
    finance_authorized: boolean(row.finance_authorized),
    orders: count(row.orders),
    gross: nullableAmount(row.gross),
    net: nullableAmount(row.net),
  })),
  salesByOperator: asRows(payload.sales_by_operator).map((row) => ({
    store_id: text(row.store_id),
    store_name: text(row.store_name, "Loja não identificada"),
    operator_user_id: text(row.operator_user_id) || null,
    operator_name: text(row.operator_name, "Operador sem nome"),
    finance_authorized: boolean(row.finance_authorized),
    orders: count(row.orders),
    gross: nullableAmount(row.gross),
  })),
  cashSessionsByRegister: asRows(payload.cash_sessions_by_register).map((row) => ({
    store_id: text(row.store_id),
    store_name: text(row.store_name, "Loja não identificada"),
    register_id: text(row.register_id),
    register_name: text(row.register_name, "Caixa não identificado"),
    finance_authorized: boolean(row.finance_authorized),
    sessions: count(row.sessions),
    open_sessions: count(row.open_sessions),
    closed_sessions: count(row.closed_sessions),
    divergent_sessions: nullableAmount(row.divergent_sessions),
    absolute_difference: nullableAmount(row.absolute_difference),
  })),
});
