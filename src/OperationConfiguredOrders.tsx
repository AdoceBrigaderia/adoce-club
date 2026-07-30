import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarDays, CircleDollarSign, PackageSearch, RefreshCw, Search, ShieldAlert } from "lucide-react";
import { bffRpc } from "./services/bff-rpc";
import "./operation-configured-orders.css";

type OrderConfiguration = {
  kind: string;
  summary: unknown;
  selection: Record<string, unknown>;
  estimated_price: number | null;
  estimated_internal_cost: number | null;
};

type OrderPricing = {
  total_price?: number;
  total_cost?: number;
  gross_profit?: number;
  margin?: number;
  markup?: number;
  minimum_margin?: number;
  margin_alert?: boolean;
  data_status?: string;
  captured_at?: string;
} | null;

type ConfiguredOrder = {
  id: string;
  request_number: string;
  profile_id: string | null;
  status: string;
  source: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  quantity: number;
  desired_start: string;
  desired_end: string;
  service_location: string;
  customer_notes: string;
  internal_notes: string;
  quoted_total: number | null;
  deposit_amount: number | null;
  deposit_paid_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  product: {
    id: string;
    name: string;
    segment: string;
    product_type: string;
    customization_mode: string;
    image_url: string | null;
    base_price: number | null;
  };
  configuration: OrderConfiguration;
  pricing: OrderPricing;
};

const statusLabels: Record<string, string> = {
  prebooked: "Pré-reserva",
  quoted: "Orçamento enviado",
  awaiting_deposit: "Aguardando sinal",
  confirmed: "Confirmada",
  in_production: "Em produção",
  ready: "Pronta",
  completed: "Concluída",
  cancelled: "Cancelada",
  expired: "Expirada",
};

const kindLabels: Record<string, string> = {
  cake: "Torta",
  sweet: "Docinhos",
  cookie: "Biscoitos",
  school_kit: "Kit Adoce na Escola",
  fixed: "Produto fixo",
};

const money = (value: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));

function configurationLines(configuration: OrderConfiguration) {
  if (Array.isArray(configuration.summary)) {
    return configuration.summary.filter((item): item is string => typeof item === "string" && item.trim() !== "");
  }
  if (configuration.summary && typeof configuration.summary === "object") {
    return Object.entries(configuration.summary as Record<string, unknown>).flatMap(([group, value]) => {
      const labels = Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : typeof value === "string" ? [value] : [];
      return labels.length ? [`${group.replace(/_/g, " ")}: ${labels.join(", ")}`] : [];
    });
  }
  if (typeof configuration.summary === "string" && configuration.summary.trim()) return [configuration.summary.trim()];
  return [];
}

export default function OperationConfiguredOrders() {
  const [orders, setOrders] = useState<ConfiguredOrder[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const load = async (nextSearch = search, nextStatus = status) => {
    setLoading(true);
    setNotice("");
    try {
      const result = await bffRpc<ConfiguredOrder[]>("staff_get_service_request_workspace", {
        search_text: nextSearch.trim(),
        requested_status: nextStatus || null,
        result_limit: 80,
      });
      setOrders(Array.isArray(result) ? result : []);
      if (!result?.length) setNotice("Nenhuma encomenda encontrada com estes filtros.");
    } catch (error) {
      setOrders([]);
      setNotice(error instanceof Error ? error.message : "Não foi possível carregar as encomendas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load("", ""); }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void load();
  };

  const urgentCount = useMemo(
    () => orders.filter((order) => ["confirmed", "in_production", "ready"].includes(order.status)).length,
    [orders],
  );

  return (
    <section className="operation-configured-orders">
      <header>
        <div>
          <small>Encomendas estruturadas</small>
          <h2>Sabores, quantidades e adicionais</h2>
          <p>Abra rapidamente o que cada cliente escolheu, sem depender de texto solto ou memória.</p>
        </div>
        <span><PackageSearch /><strong>{urgentCount}</strong><small>em andamento</small></span>
      </header>

      <form onSubmit={submit}>
        <label><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Número, cliente, telefone ou produto" /></label>
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filtrar por situação">
          <option value="">Todas as situações</option>
          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button disabled={loading}>{loading ? "Carregando…" : "Buscar"}</button>
        <button type="button" className="secondary" onClick={() => void load()} aria-label="Atualizar encomendas"><RefreshCw /></button>
      </form>

      {notice ? <p className="operation-configured-orders-notice" role="status">{notice}</p> : null}

      <div className="operation-configured-orders-list">
        {orders.map((order) => {
          const lines = configurationLines(order.configuration);
          return <article key={order.id}>
            <header>
              <div><small>{kindLabels[order.configuration.kind] || order.configuration.kind}</small><h3>{order.product.name}</h3><p>{order.request_number} · {order.customer_name}</p></div>
              <span className={`status status-${order.status}`}>{statusLabels[order.status] || order.status}</span>
            </header>
            <div className="operation-configured-order-meta">
              <span><CalendarDays /><div><small>Data desejada</small><strong>{new Date(order.desired_start).toLocaleString("pt-BR")}</strong></div></span>
              <span><PackageSearch /><div><small>Quantidade</small><strong>{order.quantity} unidade(s)</strong></div></span>
              <span><CircleDollarSign /><div><small>Estimativa</small><strong>{money(order.configuration.estimated_price ?? order.pricing?.total_price ?? order.quoted_total)}</strong></div></span>
            </div>
            <section>
              <strong>Escolhas registradas</strong>
              {lines.length ? <ul>{lines.map((line) => <li key={line}>{line}</li>)}</ul> : <p>Produto sem personalização ou pedido antigo sem composição estruturada.</p>}
            </section>
            {order.pricing?.margin_alert ? <p className="operation-configured-order-alert"><ShieldAlert /> Margem abaixo do mínimo configurado.</p> : null}
            <footer><a href={`tel:+${order.customer_phone}`}>{order.customer_phone}</a>{order.customer_notes ? <span>{order.customer_notes}</span> : null}</footer>
          </article>;
        })}
      </div>
    </section>
  );
}
