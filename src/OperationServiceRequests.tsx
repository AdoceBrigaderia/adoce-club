import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  MessageCircle,
  PackageCheck,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { bffRpc } from "./services/bff-rpc";
import "./operation-service-requests.css";

type ProductSummary = {
  id: string;
  name: string;
  segment: string;
  product_type: string;
  customization_mode: string;
  image_url: string | null;
  base_price: number | null;
};

type RequestConfiguration = {
  kind: string;
  summary: unknown;
  selection: Record<string, unknown>;
  estimated_price: number | null;
  estimated_internal_cost: number | null;
};

type RequestPricing = {
  total_price: number;
  total_cost?: number;
  gross_profit?: number;
  margin?: number;
  markup?: number;
  minimum_margin?: number;
  margin_alert: boolean;
  data_status: string;
  captured_at: string;
};

type ServiceRequestWorkspaceItem = {
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
  product: ProductSummary;
  configuration: RequestConfiguration;
  pricing: RequestPricing | null;
};

const statusOptions = [
  ["", "Ativas"],
  ["prebooked", "Pré-reservas"],
  ["awaiting_deposit", "Aguardando sinal"],
  ["confirmed", "Confirmadas"],
  ["in_production", "Em produção"],
  ["ready", "Prontas"],
  ["completed", "Concluídas"],
] as const;

const activeStatuses = new Set([
  "prebooked",
  "quoted",
  "awaiting_deposit",
  "confirmed",
  "in_production",
  "ready",
]);

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

const groupLabels: Record<string, string> = {
  cake_layers: "Massas",
  filling_layers: "Recheios",
  topping: "Cobertura",
  filling_fruits: "Frutas no recheio",
  topping_fruits: "Frutas na cobertura",
  filling_extras: "Adicionais no recheio",
  topping_extras: "Adicionais na cobertura",
  sabores: "Sabores",
  flavors: "Sabores",
  adicionais: "Adicionais",
  addons: "Adicionais",
  formatos: "Formatos",
  temas: "Temas",
  embalagens: "Embalagens",
};

const money = (value: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));

const dateTime = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Fortaleza",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));

function configurationLines(configuration: RequestConfiguration) {
  const summary = configuration.summary;
  if (Array.isArray(summary)) {
    return summary.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map((label) => ({ group: "Escolhas", label }));
  }
  if (summary && typeof summary === "object") {
    return Object.entries(summary as Record<string, unknown>).flatMap(([group, value]) => {
      const labels = Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : typeof value === "string" && value.trim().length > 0
          ? [value]
          : [];
      return labels.map((label) => ({ group: groupLabels[group] || group.replace(/_/g, " "), label }));
    });
  }

  const selection = configuration.selection;
  const items = selection && Array.isArray(selection.items) ? selection.items : [];
  return items.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    const label = typeof record.label === "string" ? record.label : "";
    const quantity = Number(record.quantity || 0);
    if (!label) return [];
    const group = typeof record.group_key === "string" ? record.group_key : "Escolhas";
    return [{ group: groupLabels[group] || group.replace(/_/g, " "), label: `${quantity || 1}× ${label}` }];
  });
}

export default function OperationServiceRequests() {
  const [items, setItems] = useState<ServiceRequestWorkspaceItem[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const load = useCallback(async (nextSearch = search, nextStatus = status) => {
    setLoading(true);
    setNotice("");
    try {
      const data = await bffRpc<ServiceRequestWorkspaceItem[]>("staff_get_service_request_workspace", {
        search_text: nextSearch.trim(),
        requested_status: nextStatus || null,
        result_limit: 80,
      });
      const normalized = (data || []).filter((item) => nextStatus || activeStatuses.has(item.status));
      setItems(normalized);
      setNotice(normalized.length ? "Encomendas atualizadas." : "Nenhuma encomenda encontrada neste filtro.");
    } catch (error) {
      setItems([]);
      setNotice(error instanceof Error ? error.message : "Não foi possível carregar as encomendas.");
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(search, status), search.trim() ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [search, status, load]);

  const attentionCount = useMemo(
    () => items.filter((item) => ["prebooked", "awaiting_deposit"].includes(item.status)).length,
    [items],
  );

  return (
    <section className="operation-service-requests" aria-busy={loading}>
      <header className="operation-service-requests-heading">
        <div>
          <small>Encomendas do site e atendimento</small>
          <h2>Pedidos, sabores e adicionais</h2>
          <p>Veja exatamente o que a cliente escolheu, sem depender de texto livre ou confirmação por memória.</p>
        </div>
        <span className={attentionCount ? "attention" : "clear"}>
          {attentionCount ? <AlertTriangle /> : <PackageCheck />}
          <strong>{attentionCount}</strong>
          <small>aguardando ação</small>
        </span>
      </header>

      <div className="operation-service-requests-controls">
        <label>
          <Search />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cliente, WhatsApp, produto ou número"
            autoComplete="off"
          />
        </label>
        <button type="button" onClick={() => void load()} disabled={loading} aria-label="Atualizar encomendas">
          <RefreshCw /> {loading ? "Atualizando…" : "Atualizar"}
        </button>
      </div>

      <nav className="operation-service-requests-filters" aria-label="Filtrar encomendas por situação">
        {statusOptions.map(([value, label]) => (
          <button
            type="button"
            key={value || "active"}
            className={status === value ? "active" : ""}
            aria-pressed={status === value}
            onClick={() => setStatus(value)}
          >
            {label}
          </button>
        ))}
      </nav>

      {notice ? <p className="operation-service-requests-notice" role="status">{notice}</p> : null}

      <div className="operation-service-request-list">
        {items.map((item) => {
          const lines = configurationLines(item.configuration);
          const phone = item.customer_phone.replace(/\D/g, "");
          const whatsappText = encodeURIComponent(
            `Olá, ${item.customer_name.split(" ")[0]}! Estamos conferindo sua encomenda ${item.request_number} de ${item.product.name}.`,
          );
          return (
            <article key={item.id} className={`status-${item.status}`}>
              <header>
                <div>
                  <small>{item.request_number}</small>
                  <h3>{item.customer_name}</h3>
                  <p>{item.product.name} · {item.quantity} unidade(s)</p>
                </div>
                <span>{statusLabels[item.status] || item.status}</span>
              </header>

              <div className="operation-service-request-meta">
                <span><CalendarDays /><small>Data desejada</small><strong>{dateTime(item.desired_start)}</strong></span>
                <span><Clock3 /><small>Recebida em</small><strong>{dateTime(item.created_at)}</strong></span>
                <span><CircleDollarSign /><small>Valor estimado</small><strong>{money(item.pricing?.total_price ?? item.configuration.estimated_price ?? item.quoted_total)}</strong></span>
              </div>

              <section className="operation-service-request-choices">
                <header><ShieldCheck /><div><small>Composição registrada</small><strong>Sabores, montagem e adicionais</strong></div></header>
                {lines.length ? (
                  <div>
                    {lines.map((line, index) => (
                      <span key={`${line.group}-${line.label}-${index}`}><small>{line.group}</small><strong>{line.label}</strong></span>
                    ))}
                  </div>
                ) : <p>Produto sem personalização estruturada.</p>}
              </section>

              {item.customer_notes ? <p className="operation-service-request-notes"><strong>Observações:</strong> {item.customer_notes}</p> : null}

              <footer>
                <a href={`https://wa.me/${phone}?text=${whatsappText}`} target="_blank" rel="noreferrer">
                  <MessageCircle /> Falar no WhatsApp
                </a>
                {item.pricing?.margin_alert ? <span className="margin-alert"><AlertTriangle /> Margem abaixo do mínimo</span> : null}
              </footer>
            </article>
          );
        })}
      </div>
    </section>
  );
}
