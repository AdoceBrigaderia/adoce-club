export type BusinessRole =
  | "owner"
  | "manager"
  | "attendant"
  | "cashier"
  | "production"
  | "viewer"
  | string;

export type CashMovementLike = {
  direction: "in" | "out" | string;
  payment_method_code: string | null;
  amount: number | string;
};

export type StoreAssignmentLike = {
  active: boolean;
  can_sell: boolean;
  can_open_cash: boolean;
  can_close_cash: boolean;
  can_manage_stock: boolean;
  can_view_finance: boolean;
};

export type AssignmentCapability =
  | "can_sell"
  | "can_open_cash"
  | "can_close_cash"
  | "can_manage_stock"
  | "can_view_finance";

export const cashMovementLabels: Record<string, string> = {
  sale: "Venda",
  supply: "Suprimento",
  withdrawal: "Sangria",
  refund: "Estorno",
  expense: "Despesa",
  adjustment_in: "Ajuste de entrada",
  adjustment_out: "Ajuste de saída",
};

const roleCapabilityCeiling: Record<string, ReadonlySet<AssignmentCapability>> = {
  owner: new Set<AssignmentCapability>([
    "can_sell",
    "can_open_cash",
    "can_close_cash",
    "can_manage_stock",
    "can_view_finance",
  ]),
  manager: new Set<AssignmentCapability>([
    "can_sell",
    "can_open_cash",
    "can_close_cash",
    "can_manage_stock",
    "can_view_finance",
  ]),
  attendant: new Set<AssignmentCapability>(["can_sell"]),
  cashier: new Set<AssignmentCapability>([
    "can_sell",
    "can_open_cash",
    "can_close_cash",
  ]),
  production: new Set<AssignmentCapability>(["can_manage_stock"]),
  viewer: new Set<AssignmentCapability>(),
};

const cents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function numericMoney(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value || 0);
  return Number.isFinite(parsed) ? cents(parsed) : 0;
}

export function cashMovementDelta(movement: CashMovementLike) {
  if (movement.payment_method_code !== "cash") return 0;
  const amount = numericMoney(movement.amount);
  return movement.direction === "out" ? -amount : amount;
}

export function calculateExpectedCash(
  openingFloat: number | string,
  movements: CashMovementLike[],
) {
  return cents(
    numericMoney(openingFloat)
      + movements.reduce((total, movement) => total + cashMovementDelta(movement), 0),
  );
}

export function calculateCashDifference(
  expectedCash: number | string,
  countedCash: number | string,
) {
  return cents(numericMoney(countedCash) - numericMoney(expectedCash));
}

export function isManagerRole(role: BusinessRole) {
  return role === "owner" || role === "manager";
}

export function roleAllowsCapability(
  role: BusinessRole,
  capability: AssignmentCapability,
) {
  return roleCapabilityCeiling[role]?.has(capability) ?? false;
}

export function assignmentAllows(
  role: BusinessRole,
  assignment: StoreAssignmentLike | null | undefined,
  capability: AssignmentCapability,
) {
  if (!roleAllowsCapability(role, capability)) return false;
  if (isManagerRole(role)) return true;
  return Boolean(assignment?.active && assignment[capability]);
}

export function slugifyBusinessCode(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function formatBusinessMoney(value: number | string | null | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numericMoney(value));
}
