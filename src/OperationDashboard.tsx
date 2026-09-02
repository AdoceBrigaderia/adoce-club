import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  PackageCheck,
  RefreshCw,
  ShoppingCart,
  Users,
} from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import { countCustomerProfiles } from "./customer-search";
import WhatsAppSupportInbox from "./WhatsAppSupportInbox";
import "./operation-dashboard.css";

export type DashboardDestination =
  | "customers"
  | "sales"
  | "requests"
  | "catalog"
  | "availability"
  | "low-stock";

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
  operatorName,
}: {
  onNavigate: (destination: DashboardDestination) => void;
  operatorName?: string;
}) {
  const [data, setData] = useState(emptyData);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [deviceStatus, setDeviceStatus] = useState<{ tablet_online: boolean; printer_online: boolean; service_state: string; pending_count: number; last_seen_at: string } | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    const supabase = requireSupabase();
    const loadAllProfiles = async () => {
      const rows: Array<{ id: string; account_status: string | null }> = [];
      for (let from = 0; ; from += 1000) {
        const page = await supabase
          .from("profiles")
          .select("id,account_status")
          .order("id", { ascending: true })
          .range(from, from + 999);
        if (page.error) return { data: rows, error: page.error };
        rows.push(...(page.data || []));
        if ((page.data || []).length < 1000) return { data: rows, error: null };
      }
    };
    const [orders, requests, profiles, staffMembers, availability, plannedProduction] =
      await Promise.all([
      supabase
        .from("instant_orders")
        .select("status")
        .not("status", "in", '("completed","cancelled","expired")'),
      supabase
        .from("service_requests")
        .select("status")
        .not("status", "in", '("completed","cancelled","expired")'),
      loadAllProfiles(),
      supabase.from("staff_members").select("user_id"),
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
      profiles.error ||
      staffMembers.error ||
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
    const staffIds = new Set((staffMembers.data || []).map((staff) => staff.user_id));
    const customerCount = countCustomerProfiles(profiles.data || [], staffIds);
    setData({
      activeSales: saleRows.length,
      awaitingPayment: saleRows.filter((item) => ["awaiting_payment", "reserved"].includes(item.status)).length,
      ready: saleRows.filter((item) => item.status === "ready").length,
      activeRequests: (requests.data || []).length,
      members: customerCount,
      lowStock,
      productionPending: pendingProductionRows.length,
      productionPendingUnits,
    });
    setNotice("");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const supabase = requireSupabase();
    const refresh = async () => {
      const { data } = await supabase.from("operation_device_status").select("tablet_online,printer_online,service_state,pending_count,last_seen_at").eq("device_key", "tablet-operacao-adoce-01").maybeSingle();
      if (data) setDeviceStatus(data);
    };
    void refresh();
    const channel = supabase.channel("operation-device-status").on("postgres_changes", { event: "*", schema: "public", table: "operation_device_status" }, () => void refresh()).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

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

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? "Bom dia" : currentHour < 18 ? "Boa tarde" : "Boa noite";
  const todayLabel = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Fortaleza",
  }).format(new Date());

  return (
    <section className="operation-dashboard">
      <header className="operation-dashboard-heading">
        <div>
          <span>Visão do dia</span>
          <h1>{greeting}, <em>{operatorName || "Adoce"}</em></h1>
          <p className="operation-dashboard-date">{todayLabel}</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={busy}>
          <RefreshCw /> {busy ? "Atualizando…" : "Atualizar"}
        </button>
      </header>

      {notice ? <p className="operation-dashboard-notice">{notice}</p> : null}

      <div className="operation-device-status" aria-label="Status do tablet e da impressora">
        <span className={deviceStatus?.tablet_online ? "online" : "offline"}><i /> Tablet {deviceStatus?.tablet_online ? "online" : "offline"}</span>
        <span className={deviceStatus?.printer_online ? "online" : "offline"}><i /> Impressora {deviceStatus?.printer_online ? "online" : "offline"}</span>
        {deviceStatus?.pending_count ? <small>{deviceStatus.pending_count} pedido(s) na fila de impressão</small> : null}
      </div>

      <WhatsAppSupportInbox />

      <div className="operation-dashboard-heroes">
        <button type="button" className="operation-hero-sale" onClick={() => onNavigate("sales")}>
          <ShoppingCart />
          <span>
            <strong>Vender fatias</strong>
            <small>Caixa, pedidos do site e retirada</small>
          </span>
          <ArrowRight />
        </button>
        <button type="button" className="operation-hero-club" onClick={() => onNavigate("customers")}>
          <Users />
          <span>
            <strong>Carimbar cliente</strong>
            <small>Cartão fidelidade e cadastro rápido</small>
          </span>
          <ArrowRight />
        </button>
      </div>

      <div className="operation-dashboard-priority">
        <div>
          <AlertTriangle />
          <span><small>Precisa de atenção</small><strong>{priority}</strong></span>
        </div>
        <p>{priority ? "Confira pedidos, retiradas e itens com poucas unidades." : "Nada urgente neste momento."}</p>
      </div>

      <div className="operation-dashboard-metrics">
        <button
          type="button"
          onClick={() => onNavigate("availability")}
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
        <button type="button" onClick={() => onNavigate("sales")}><ShoppingCart /><span><strong>{data.awaitingPayment}</strong><small>aguardando pagamento</small></span><ArrowRight /></button>
        <button type="button" onClick={() => onNavigate("sales")}><PackageCheck /><span><strong>{data.ready}</strong><small>prontas para retirada</small></span><ArrowRight /></button>
        <button type="button" onClick={() => onNavigate("requests")}><PackageCheck /><span><strong>{data.activeRequests}</strong><small>solicitações em aberto</small></span><ArrowRight /></button>
        <button type="button" onClick={() => onNavigate("customers")}><Users /><span><strong>{data.members}</strong><small>clientes cadastrados</small></span><ArrowRight /></button>
        <button type="button" onClick={() => onNavigate("low-stock")} className={data.lowStock ? "is-warning" : ""}><AlertTriangle /><span><strong>{data.lowStock}</strong><small>itens com estoque baixo</small></span><ArrowRight /></button>
      </div>

      <div className="operation-dashboard-shortcuts">
        <div><small>Acesso rápido</small><h2>O que você quer fazer agora?</h2></div>
        <button type="button" onClick={() => onNavigate("sales")}><ShoppingCart /><span>Venda rápida<small>Lançar ou acompanhar</small></span><ArrowRight /></button>
        <button type="button" onClick={() => onNavigate("requests")}><PackageCheck /><span>Pedidos futuros<small>Solicitações e retiradas</small></span><ArrowRight /></button>
        <button type="button" onClick={() => onNavigate("customers")}><Users /><span>Clientes<small>Buscar e gerenciar Clube</small></span><ArrowRight /></button>
        <button type="button" onClick={() => onNavigate("availability")}><PackageCheck /><span>Produtos<small>Disponibilidade e produção</small></span><ArrowRight /></button>
      </div>
    </section>
  );
}
