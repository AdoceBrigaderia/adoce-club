import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  PackageCheck,
  QrCode,
  RefreshCw,
  ShoppingCart,
  Users,
  WifiOff,
} from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import {
  buildDashboardData,
  dashboardAttentionCount,
  dashboardCustomerCount,
  dashboardLoadMessage,
  dashboardPriorities,
  emptyDashboardData,
  operationTodayKey,
  type DashboardData,
  type DashboardDestination,
  type DashboardSource,
} from "./operation-dashboard-model";
import "./operation-dashboard.css";

const OperationBusinessHub = lazy(() => import("./OperationBusinessHub"));

export type { DashboardDestination } from "./operation-dashboard-model";

const priorityIcons = {
  payment: CircleDollarSign,
  pickup: PackageCheck,
  production: PackageCheck,
  stock: AlertTriangle,
} as const;

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});

export default function OperationDashboard({
  onNavigate,
}: {
  onNavigate: (destination: DashboardDestination) => void;
}) {
  const [data, setData] = useState<DashboardData>(emptyDashboardData);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);

  const load = useCallback(async () => {
    if (!navigator.onLine) {
      setOnline(false);
      setNotice(dashboardLoadMessage([], false));
      return;
    }

    setBusy(true);
    const supabase = requireSupabase();
    const [orders, requests, members, staff, availability, plannedProduction] =
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
          .from("staff_members")
          .select("user_id", { count: "exact", head: true })
          .eq("active", true),
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

    const failedSources: DashboardSource[] = [];
    if (orders.error) failedSources.push("sales");
    if (requests.error) failedSources.push("requests");
    if (members.error) failedSources.push("members");
    if (staff.error) failedSources.push("staff");
    if (availability.error) failedSources.push("availability");
    if (plannedProduction.error) failedSources.push("production");

    if (failedSources.length < 6) {
      setData(
        buildDashboardData({
          sales: orders.error ? [] : orders.data || [],
          requests: requests.error ? [] : requests.data || [],
          members: dashboardCustomerCount(
            members.error ? 0 : members.count,
            staff.error ? 0 : staff.count,
          ),
          availability: availability.error ? [] : availability.data || [],
          production: plannedProduction.error
            ? []
            : plannedProduction.data || [],
        }),
      );
      setLastUpdatedAt(new Date());
    }

    setOnline(true);
    setNotice(dashboardLoadMessage(failedSources));
    setBusy(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      void load();
    };
    const handleOffline = () => {
      setOnline(false);
      setNotice(dashboardLoadMessage([], false));
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [load]);

  const priorities = useMemo(() => dashboardPriorities(data), [data]);
  const attentionCount = useMemo(
    () => dashboardAttentionCount(data),
    [data],
  );

  return (
    <section className="operation-dashboard" aria-busy={busy}>
      <header className="operation-dashboard-heading">
        <div>
          <span>Visão do dia</span>
          <h1>Central da operação</h1>
          <p>
            Venda, acompanhe pedidos, localize clientes e resolva pendências sem
            procurar em vários menus.
          </p>
          <small className="operation-dashboard-updated">
            {online ? <Clock3 /> : <WifiOff />}
            {lastUpdatedAt
              ? `Última atualização às ${timeFormatter.format(lastUpdatedAt)}`
              : online
                ? "Preparando os números da operação"
                : "Aguardando conexão"}
          </small>
        </div>
        <button type="button" onClick={() => void load()} disabled={busy || !online}>
          <RefreshCw /> {busy ? "Atualizando…" : "Atualizar"}
        </button>
      </header>

      {notice ? (
        <p className="operation-dashboard-notice" role="status">
          {online ? <AlertTriangle /> : <WifiOff />}
          <span>{notice}</span>
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

      <Suspense fallback={<p className="operation-dashboard-notice">Carregando lojas, caixas e equipe…</p>}>
        <OperationBusinessHub />
      </Suspense>

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

      <nav className="operation-dashboard-mobile-dock" aria-label="Atalhos rápidos da operação">
        <button type="button" onClick={() => onNavigate("sales")}><ShoppingCart /><span>Vender</span></button>
        <button type="button" onClick={() => onNavigate("requests")}><CalendarDays /><span>Pedidos</span></button>
        <button type="button" onClick={() => onNavigate("customers")}><QrCode /><span>Cliente</span></button>
        <button type="button" onClick={() => onNavigate("content")}><PackageCheck /><span>Produção</span></button>
        <button type="button" onClick={() => onNavigate("finance")}><CircleDollarSign /><span>Financeiro</span></button>
      </nav>
    </section>
  );
}
