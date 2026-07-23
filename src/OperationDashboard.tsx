import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CircleDollarSign,
  PackageCheck,
  RefreshCw,
  ShoppingCart,
  Users,
} from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import "./operation-dashboard.css";

export type DashboardDestination =
  | "customers"
  | "sales"
  | "agenda"
  | "requests"
  | "finance"
  | "catalog"
  | "content";

type DashboardData = {
  activeSales: number;
  awaitingPayment: number;
  ready: number;
  activeRequests: number;
  members: number;
  lowStock: number;
  productionPending: number;
  productionPendingUnits: number;
};

const emptyData: DashboardData = {
  activeSales: 0,
  awaitingPayment: 0,
  ready: 0,
  activeRequests: 0,
  members: 0,
  lowStock: 0,
  productionPending: 0,
  productionPendingUnits: 0,
};
const todayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date());

export default function OperationDashboard({
  onNavigate,
}: {
  onNavigate: (destination: DashboardDestination) => void;
}) {
  const [data, setData] = useState(emptyData);
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
        .eq("service_date", todayKey()),
      supabase
        .from("weekly_service_menu")
        .select("quantity_planned,quantity_released,status")
        .eq("service_date", todayKey())
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
      setNotice("Alguns números não puderam ser atualizados agora. As áreas da operação continuam disponíveis.");
      return;
    }

    const saleRows = orders.data || [];
    const lowStock = (availability.data || []).filter((item) => {
      const remaining = Number(item.quantity_available || 0) - Number(item.quantity_reserved || 0);
      return item.status !== "unavailable" && item.quantity_available != null && remaining >= 0 && remaining <= 3;
    }).length;
    const pendingProductionRows = (plannedProduction.data || []).filter(
      (item) =>
        Number(item.quantity_planned || 0) >
        Number(item.quantity_released || 0),
    );
    const productionPendingUnits = pendingProductionRows.reduce(
      (sum, item) =>
        sum +
        Math.max(
          Number(item.quantity_planned || 0) -
            Number(item.quantity_released || 0),
          0,
        ),
      0,
    );
    setData({
      activeSales: saleRows.length,
      awaitingPayment: saleRows.filter((item) => ["awaiting_payment", "reserved"].includes(item.status)).length,
      ready: saleRows.filter((item) => item.status === "ready").length,
      activeRequests: (requests.data || []).length,
      members: members.count || 0,
      lowStock,
      productionPending: pendingProductionRows.length,
      productionPendingUnits,
    });
    setNotice("");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const priority = useMemo(
    () =>
      data.awaitingPayment +
      data.ready +
      data.lowStock +
      data.productionPending,
    [
      data.awaitingPayment,
      data.ready,
      data.lowStock,
      data.productionPending,
    ],
  );

  return (
    <section className="operation-dashboard">
      <header className="operation-dashboard-heading">
        <div>
          <span>Visão do dia</span>
          <h1>Central da operação</h1>
          <p>Comece pelo que precisa de atenção e chegue a cada tarefa sem procurar em vários menus.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={busy}>
          <RefreshCw /> {busy ? "Atualizando…" : "Atualizar"}
        </button>
      </header>

      {notice ? <p className="operation-dashboard-notice">{notice}</p> : null}

      <div className="operation-dashboard-priority">
        <div>
          <AlertTriangle />
          <span><small>Precisa de atenção</small><strong>{priority}</strong></span>
        </div>
        <p>{priority ? "Confira pagamentos, retiradas e itens com poucas unidades." : "Nada urgente neste momento."}</p>
      </div>

      <div className="operation-dashboard-metrics">
        <button
          type="button"
          onClick={() => onNavigate("content")}
          className={data.productionPending ? "is-warning" : ""}
        >
          <PackageCheck />
          <span>
            <strong>{data.productionPending}</strong>
            <small>
              {data.productionPendingUnits
                ? `${data.productionPendingUnits} fatias aguardam liberação`
                : "produção do dia conferida"}
            </small>
          </span>
          <ArrowRight />
        </button>
        <button type="button" onClick={() => onNavigate("sales")}><ShoppingCart /><span><strong>{data.activeSales}</strong><small>vendas em andamento</small></span><ArrowRight /></button>
        <button type="button" onClick={() => onNavigate("sales")}><CircleDollarSign /><span><strong>{data.awaitingPayment}</strong><small>aguardando pagamento</small></span><ArrowRight /></button>
        <button type="button" onClick={() => onNavigate("sales")}><PackageCheck /><span><strong>{data.ready}</strong><small>prontas para retirada</small></span><ArrowRight /></button>
        <button type="button" onClick={() => onNavigate("requests")}><CalendarDays /><span><strong>{data.activeRequests}</strong><small>encomendas ativas</small></span><ArrowRight /></button>
        <button type="button" onClick={() => onNavigate("customers")}><Users /><span><strong>{data.members}</strong><small>clientes cadastrados</small></span><ArrowRight /></button>
        <button type="button" onClick={() => onNavigate("catalog")} className={data.lowStock ? "is-warning" : ""}><AlertTriangle /><span><strong>{data.lowStock}</strong><small>itens com estoque baixo</small></span><ArrowRight /></button>
      </div>

      <div className="operation-dashboard-shortcuts">
        <div><small>Acesso rápido</small><h2>O que você quer fazer agora?</h2></div>
        <button type="button" onClick={() => onNavigate("sales")}><ShoppingCart /> Lançar ou acompanhar venda</button>
        <button type="button" onClick={() => onNavigate("agenda")}><CalendarDays /> Ver agenda de hoje</button>
        <button type="button" onClick={() => onNavigate("customers")}><Users /> Localizar cliente ou Clube</button>
        <button type="button" onClick={() => onNavigate("finance")}><CircleDollarSign /> Consultar financeiro</button>
      </div>
    </section>
  );
}
