import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CircleDollarSign,
  PackageCheck,
  QrCode,
  RefreshCw,
  ShoppingCart,
  Users,
} from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import {
  buildDashboardData,
  dashboardAttentionCount,
  dashboardPriorities,
  emptyDashboardData,
  operationTodayKey,
  type DashboardData,
  type DashboardDestination,
} from "./operation-dashboard-model";
import "./operation-dashboard.css";

export type { DashboardDestination } from "./operation-dashboard-model";

const priorityIcons = {
  payment: CircleDollarSign,
  pickup: PackageCheck,
  production: PackageCheck,
  stock: AlertTriangle,
} as const;

export default function OperationDashboard({
  onNavigate,
}: {
  onNavigate: (destination: DashboardDestination) => void;
}) {
  const [data, setData] = useState<DashboardData>(emptyDashboardData);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    const supabase = requireSupabase();
    const [orders, requests, members, availability, plannedProduction] =
      await Promise.all([
        supabase
          .from("instant_orders")
          .select("status")
          .not("status", "in", '("completed","cancelled","expired")'),
        supabase
          .from("service_requests")
          .select("status")
          .not("status", "in", '("completed","cancelled","expired")'),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase
          .from("flavor_availability")
          .select("quantity_available,quantity_reserved,status")
          .eq("service_date", operationTodayKey()),
        supabase
          .from("weekly_service_menu")
          .select("quantity_planned,quantity_released,status")
          .eq("service_date", operationTodayKey())
          .eq("channel_slug", "online_orders")
          .eq("status", "published"),
      ]);

    const firstError =
      orders.error ||
      requests.error ||
      members.error ||
      availability.error ||
      plannedProduction.error;

    setBusy(false);
    if (firstError) {
      setNotice(
        "Alguns números não puderam ser atualizados agora. Os atalhos da operação continuam disponíveis.",
      );
      return;
    }

    setData(
      buildDashboardData({
        sales: orders.data || [],
        requests: requests.data || [],
        members: members.count || 0,
        availability: availability.data || [],
        production: plannedProduction.data || [],
      }),
    );
    setNotice("");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const priorities = useMemo(() => dashboardPriorities(data), [data]);
  const attentionCount = useMemo(
    () => dashboardAttentionCount(data),
    [data],
  );

  return (
    <section className="operation-dashboard">
      <header className="operation-dashboard-heading">
        <div>
          <span>Visão do dia</span>
          <h1>Central da operação</h1>
          <p>
            Venda, acompanhe pedidos, localize clientes e resolva pendências sem
            procurar em vários menus.
          </p>
        </div>
        <button type="button" onClick={() => void load()} disabled={busy}>
          <RefreshCw /> {busy ? "Atualizando…" : "Atualizar"}
        </button>
      </header>

      {notice ? (
        <p className="operation-dashboard-notice" role="status">
          {notice}
        </p>
      ) : null}

      <section className="operation-dashboard-primary" aria-label="Ações principais">
        <header>
          <small>Acesso rápido</small>
          <h2>O que você quer fazer agora?</h2>
        </header>
        <button type="button" onClick={() => onNavigate("sales")}>
          <ShoppingCart />
          <span>
            <strong>Vender agora</strong>
            <small>Lançar venda ou acompanhar pagamento</small>
          </span>
          <ArrowRight />
        </button>
        <button type="button" onClick={() => onNavigate("requests")}>
          <CalendarDays />
          <span>
            <strong>Pedidos e reservas</strong>
            <small>Ver solicitações e agenda do dia</small>
          </span>
          <ArrowRight />
        </button>
        <button type="button" onClick={() => onNavigate("customers")}>
          <QrCode />
          <span>
            <strong>Cliente ou QR</strong>
            <small>Buscar cliente e abrir o Clube Adoce</small>
          </span>
          <ArrowRight />
        </button>
        <button type="button" onClick={() => onNavigate("content")}>
          <PackageCheck />
          <span>
            <strong>Produção do dia</strong>
            <small>
              {data.productionPendingUnits
                ? `${data.productionPendingUnits} fatias aguardam liberação`
                : "Liberar sabores e conferir disponibilidade"}
            </small>
          </span>
          <ArrowRight />
        </button>
      </section>

      <section
        className={`operation-dashboard-priority ${attentionCount ? "has-attention" : "is-clear"}`}
        aria-live="polite"
      >
        <header>
          <div>
            {attentionCount ? <AlertTriangle /> : <PackageCheck />}
            <span>
              <small>{attentionCount ? "Precisa de atenção" : "Operação em dia"}</small>
              <strong>{attentionCount}</strong>
            </span>
          </div>
          <p>
            {attentionCount
              ? "Abra uma pendência abaixo e resolva o que está bloqueando a operação."
              : "Nenhuma pendência crítica foi identificada neste momento."}
          </p>
        </header>

        {priorities.length ? (
          <div className="operation-dashboard-priority-list">
            {priorities.map((item) => {
              const Icon = priorityIcons[item.id];
              return (
                <button
                  type="button"
                  key={item.id}
                  className={`tone-${item.tone}`}
                  onClick={() => onNavigate(item.destination)}
                >
                  <Icon />
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                  <b>{item.count}</b>
                  <ArrowRight />
                </button>
              );
            })}
          </div>
        ) : null}
      </section>

      <section className="operation-dashboard-summary" aria-label="Resumo da operação">
        <header>
          <small>Resumo rápido</small>
          <h2>Números que orientam o atendimento</h2>
        </header>
        <div className="operation-dashboard-metrics">
          <button type="button" onClick={() => onNavigate("sales")}>
            <ShoppingCart />
            <span>
              <strong>{data.activeSales}</strong>
              <small>vendas em andamento</small>
            </span>
            <ArrowRight />
          </button>
          <button type="button" onClick={() => onNavigate("requests")}>
            <CalendarDays />
            <span>
              <strong>{data.activeRequests}</strong>
              <small>encomendas ativas</small>
            </span>
            <ArrowRight />
          </button>
          <button type="button" onClick={() => onNavigate("customers")}>
            <Users />
            <span>
              <strong>{data.members}</strong>
              <small>clientes cadastrados</small>
            </span>
            <ArrowRight />
          </button>
          <button type="button" onClick={() => onNavigate("finance")}>
            <CircleDollarSign />
            <span>
              <strong>{data.awaitingPayment}</strong>
              <small>pagamentos pendentes</small>
            </span>
            <ArrowRight />
          </button>
        </div>
      </section>
    </section>
  );
}
