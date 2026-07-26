export type DashboardDestination =
  | "customers"
  | "sales"
  | "agenda"
  | "requests"
  | "finance"
  | "catalog"
  | "content";

export type DashboardData = {
  activeSales: number;
  awaitingPayment: number;
  ready: number;
  activeRequests: number;
  members: number;
  lowStock: number;
  productionPending: number;
  productionPendingUnits: number;
};

export type DashboardInput = {
  sales: Array<{ status?: string | null }>;
  requests: Array<{ status?: string | null }>;
  members: number;
  availability: Array<{
    quantity_available?: number | null;
    quantity_reserved?: number | null;
    status?: string | null;
  }>;
  production: Array<{
    quantity_planned?: number | null;
    quantity_released?: number | null;
    status?: string | null;
  }>;
};

export type DashboardPriority = {
  id: "payment" | "pickup" | "stock" | "production";
  label: string;
  description: string;
  count: number;
  destination: DashboardDestination;
  tone: "warning" | "urgent";
};

export const emptyDashboardData: DashboardData = {
  activeSales: 0,
  awaitingPayment: 0,
  ready: 0,
  activeRequests: 0,
  members: 0,
  lowStock: 0,
  productionPending: 0,
  productionPendingUnits: 0,
};

export function operationTodayKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
  }).format(date);
}

export function buildDashboardData(input: DashboardInput): DashboardData {
  const lowStock = input.availability.filter((item) => {
    const available = Number(item.quantity_available || 0);
    const reserved = Number(item.quantity_reserved || 0);
    const remaining = available - reserved;
    return (
      item.status !== "unavailable" &&
      item.quantity_available != null &&
      remaining >= 0 &&
      remaining <= 3
    );
  }).length;

  const pendingProduction = input.production.filter(
    (item) =>
      Number(item.quantity_planned || 0) >
      Number(item.quantity_released || 0),
  );

  return {
    activeSales: input.sales.length,
    awaitingPayment: input.sales.filter((item) =>
      ["awaiting_payment", "reserved"].includes(item.status || ""),
    ).length,
    ready: input.sales.filter((item) => item.status === "ready").length,
    activeRequests: input.requests.length,
    members: input.members,
    lowStock,
    productionPending: pendingProduction.length,
    productionPendingUnits: pendingProduction.reduce(
      (total, item) =>
        total +
        Math.max(
          Number(item.quantity_planned || 0) -
            Number(item.quantity_released || 0),
          0,
        ),
      0,
    ),
  };
}

export function dashboardPriorities(data: DashboardData): DashboardPriority[] {
  const priorities: DashboardPriority[] = [
    {
      id: "payment",
      label: "Pagamentos pendentes",
      description: "Reservas e vendas aguardando confirmação de pagamento.",
      count: data.awaitingPayment,
      destination: "sales",
      tone: "urgent",
    },
    {
      id: "pickup",
      label: "Prontas para retirada",
      description: "Pedidos que já podem ser entregues ao cliente.",
      count: data.ready,
      destination: "sales",
      tone: "warning",
    },
    {
      id: "production",
      label: "Produção para liberar",
      description: data.productionPendingUnits
        ? `${data.productionPendingUnits} unidades ainda precisam ser liberadas.`
        : "Itens planejados ainda não liberados para venda.",
      count: data.productionPending,
      destination: "content",
      tone: "warning",
    },
    {
      id: "stock",
      label: "Estoque baixo",
      description: "Produtos com até 3 unidades disponíveis.",
      count: data.lowStock,
      destination: "catalog",
      tone: "warning",
    },
  ];

  return priorities.filter((item) => item.count > 0);
}

export function dashboardAttentionCount(data: DashboardData) {
  return dashboardPriorities(data).reduce((total, item) => total + item.count, 0);
}
