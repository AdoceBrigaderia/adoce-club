export type StaffRole = "owner" | "manager" | "attendant" | "viewer" | string;

export type StorePermissionSet = {
  active: boolean;
  can_sell: boolean;
  can_open_cash: boolean;
  can_close_cash: boolean;
  can_manage_stock: boolean;
  can_view_finance: boolean;
};

export type CashMovementLike = {
  direction: "in" | "out" | string;
  payment_method_code: string | null;
  amount: number | string;
};

export function normalizeBusinessSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function parseMoneyInput(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? Math.max(value, 0) : 0;
  const normalized = String(value || "")
    .replace(/\s/g, "")
    .replace(/R\$/gi, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".")
    .replace(/[^0-9.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
}

export function formatBusinessMoney(value: string | number | null | undefined) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function expectedCashAmount(
  openingFloat: string | number | null | undefined,
  movements: CashMovementLike[],
) {
  return movements.reduce((total, movement) => {
    if (movement.payment_method_code !== "cash") return total;
    const amount = Number(movement.amount || 0);
    if (!Number.isFinite(amount)) return total;
    return total + (movement.direction === "out" ? -amount : amount);
  }, Number(openingFloat || 0));
}

export function roleLabel(role: StaffRole) {
  if (role === "owner") return "Proprietário";
  if (role === "manager") return "Gerente";
  if (role === "attendant") return "Atendimento";
  if (role === "viewer") return "Consulta";
  return role || "Equipe";
}

export function defaultStorePermissions(role: StaffRole): StorePermissionSet {
  if (role === "owner" || role === "manager") {
    return {
      active: true,
      can_sell: true,
      can_open_cash: true,
      can_close_cash: true,
      can_manage_stock: true,
      can_view_finance: true,
    };
  }
  if (role === "attendant") {
    return {
      active: true,
      can_sell: true,
      can_open_cash: false,
      can_close_cash: false,
      can_manage_stock: false,
      can_view_finance: false,
    };
  }
  return {
    active: true,
    can_sell: false,
    can_open_cash: false,
    can_close_cash: false,
    can_manage_stock: false,
    can_view_finance: false,
  };
}
