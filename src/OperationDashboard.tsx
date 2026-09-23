import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  PackageCheck,
  MessageCircle,
  RefreshCw,
  ShoppingCart,
  Users,
} from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import { countCustomerProfiles } from "./customer-search";
import { supportRequest } from "./WhatsAppSupportInbox";
import RemotePrintTrigger from "./RemotePrintTrigger";
import { openOperationArea } from "./lib/operation-navigation";
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
    const refreshWhenVisible = () => { if (document.visibilityState === "visible") void load(); };
    const timer = window.setInterval(refreshWhenVisible, 60_000);
    window.addEventListener("focus", refreshWhenVisible);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refreshWhenVisible); };
  }, [load]);
  const [pendingChats, setPendingChats] = useState(0);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      void supportRequest()
        .then((result: { threads?: Array<{ has_customer_messages?: boolean }> }) => setPendingChats((result.threads || []).filter((item) => item.has_customer_messages).length))
        .catch(() => setPendingChats(0));
    };
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("adoce-support-updated", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("adoce-support-updated", refresh); };
  }, []);
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
  // O tablet manda um "estou vivo" a cada ~25s enquanto o app esta aberto,
  // mas nunca avisa quando desliga ou perde energia -- so para de mandar.
  // Sem isto, "true" gravado na ultima vez que ele respondeu ficava
  // mostrando verde pra sempre, mesmo com o tablet e a impressora desligados
  // ha muito tempo. Reavalia sozinho a cada 15s, sem depender de nenhum
  // evento novo chegar.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);
  const DEVICE_STALE_MS = 90_000;
  const lastSeenMs = deviceStatus?.last_seen_at ? new Date(deviceStatus.last_seen_at).getTime() : null;
  const deviceStale = lastSeenMs === null || now - lastSeenMs > DEVICE_STALE_MS;
  const tabletOnline = Boolean(deviceStatus?.tablet_online) && !deviceStale;
  const printerOnline = Boolean(deviceStatus?.printer_online) && !deviceStale;

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

  const attentionItems = [
    { key: "payment", count: data.awaitingPayment, label: data.awaitingPayment === 1 ? "pedido aguardando pagamento" : "pedidos aguardando pagamento", destination: "sales" as const },
    { key: "ready", count: data.ready, label: data.ready === 1 ? "pedido pronto para retirada" : "pedidos prontos para retirada", destination: "sales" as const },
    { key: "production", count: data.productionPending, label: data.productionPending === 1 ? "sabor aguardando liberação da produção" : "sabores aguardando liberação da produção", destination: "availability" as const },
    { key: "stock", count: data.lowStock, label: data.lowStock === 1 ? "sabor com estoque baixo" : "sabores com estoque baixo", destination: "low-stock" as const },
  ].filter((item) => item.count > 0);
  const devicesOffline = !tabletOnline || !printerOnline;

  return (
    <section className="operation-dashboard operation-dashboard-v4">
      <header className="operation-dashboard-heading">
        <div>
          <span>Visão do dia</span>
          <h1>{greeting}, <em>{operatorName || "Adoce"}</em></h1>
          <p className="operation-dashboard-date">{todayLabel}</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={busy} aria-label="Atualizar números do dia">
          <RefreshCw aria-hidden="true" /> <span>{busy ? "Atualizando…" : "Atualizar"}</span>
        </button>
      </header>

      {notice ? <p className="operation-dashboard-notice">{notice}</p> : null}

      <div
        className={devicesOffline ? "operation-device-status is-alert" : "operation-device-status"}
        role={devicesOffline ? "alert" : "status"}
        aria-label="Status do tablet e da impressora"
      >
        {devicesOffline ? <AlertTriangle aria-hidden="true" /> : null}
        <span className={tabletOnline ? "online" : "offline"}><i /> Tablet {tabletOnline ? "online" : "offline"}</span>
        <span className={printerOnline ? "online" : "offline"}><i /> Impressora {printerOnline ? "online" : "offline"}</span>
        {deviceStatus?.pending_count ? <small>{deviceStatus.pending_count} pedido(s) na fila de impressão</small> : null}
        {deviceStale && deviceStatus ? <small>Sem contato com o tablet desde {new Date(deviceStatus.last_seen_at).toLocaleTimeString("pt-BR")}. Confira se o tablet do balcão está ligado, com internet e com o app aberto.</small> : null}
      </div>

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

      <div className={attentionItems.length ? "operation-dashboard-priority has-items" : "operation-dashboard-priority"}>
        <div>
          <AlertTriangle aria-hidden="true" />
          <span><small>Precisa de atenção</small><strong>{priority}</strong></span>
        </div>
        {attentionItems.length ? (
          <ul>
            {attentionItems.map((item) => (
              <li key={item.key}>
                <button type="button" onClick={() => onNavigate(item.destination)}>
                  <strong>{item.count}</strong> {item.label} <ArrowRight aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : <p>Nada urgente neste momento.</p>}
      </div>

      <button type="button" className="operation-dashboard-whatsapp" onClick={() => openOperationArea({ view: "orders", channel: "official" })}>
        <MessageCircle aria-hidden="true" />
        <span>
          <strong>Conversas do WhatsApp</strong>
          <small>{pendingChats ? `${pendingChats} ${pendingChats === 1 ? "cliente aguardando resposta" : "clientes aguardando resposta"}` : "Nenhum cliente aguardando agora"}</small>
        </span>
        {pendingChats ? <b>{pendingChats}</b> : null}
        <ArrowRight aria-hidden="true" />
      </button>

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
        <button type="button" onClick={() => onNavigate("requests")}><PackageCheck /><span><strong>{data.activeRequests}</strong><small>encomendas em aberto</small></span><ArrowRight /></button>
        <button type="button" onClick={() => onNavigate("customers")}><Users /><span><strong>{data.members}</strong><small>clientes cadastrados</small></span><ArrowRight /></button>
        <button type="button" onClick={() => onNavigate("low-stock")} className={data.lowStock ? "is-warning" : ""}><AlertTriangle /><span><strong>{data.lowStock}</strong><small>itens com estoque baixo</small></span><ArrowRight /></button>
      </div>

      <div className="operation-dashboard-shortcuts">
        <div><small>Acesso rápido</small><h2>Outras tarefas</h2></div>
        <button type="button" onClick={() => onNavigate("requests")}><PackageCheck /><span>Encomendas<small>Pedidos futuros e retiradas</small></span><ArrowRight /></button>
        <button type="button" onClick={() => onNavigate("availability")}><PackageCheck /><span>Produção de hoje<small>Liberar sabores e quantidades</small></span><ArrowRight /></button>
      </div>

      <RemotePrintTrigger />
    </section>
  );
}
