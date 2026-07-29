import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  ChefHat,
  CircleDollarSign,
  Clock3,
  MessageCircle,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Store,
  XCircle,
} from "lucide-react";
import { bffRpc } from "./services/bff-rpc";
import "./operation-service-requests.css";

type StoreRow = {
  id: string;
  name: string;
  public_label?: string;
  active: boolean;
};

type BusinessWorkspace = { stores?: StoreRow[] };

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
  store_id: string;
  store: {
    id: string;
    name: string;
    public_label: string;
  };
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
  quoted_at: string | null;
  deposit_amount: number | null;
  deposit_paid_at: string | null;
  deposit_payment_method: string | null;
  payment_status: string;
  paid_amount: number;
  balance_paid_at: string | null;
  balance_payment_method: string | null;
  production_started_at: string | null;
  ready_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  refunded_at: string | null;
  refund_method: string | null;
  last_action: string | null;
  last_action_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  product: ProductSummary;
  configuration: RequestConfiguration;
  pricing: RequestPricing | null;
};

type LifecycleAction =
  | "send_quote"
  | "request_deposit"
  | "confirm_deposit"
  | "confirm_order"
  | "confirm_payment"
  | "start_production"
  | "mark_ready"
  | "complete"
  | "cancel"
  | "confirm_refund";

type LifecycleResult = {
  request_number: string;
  status: string;
  payment_status: string;
  refund_required: boolean;
  idempotent: boolean;
};

const statusOptions = [
  ["", "Ativas"],
  ["prebooked", "Pré-reservas"],
  ["awaiting_deposit", "Aguardando sinal"],
  ["confirmed", "Confirmadas"],
  ["in_production", "Em produção"],
  ["ready", "Prontas"],
  ["completed", "Concluídas"],
  ["cancelled", "Canceladas"],
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

const paymentStatusLabels: Record<string, string> = {
  pending: "Pagamento pendente",
  partial: "Sinal recebido",
  paid: "Pagamento completo",
  refund_pending: "Estorno pendente",
  refunded: "Estornado",
};

const paymentMethods = [
  ["pix", "Pix"],
  ["card", "Cartão"],
  ["cash", "Dinheiro"],
  ["mercado_pago_point", "Mercado Pago Point"],
  ["mercado_pago_link", "Link Mercado Pago"],
  ["other", "Outro"],
] as const;

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

function quickActions(item: ServiceRequestWorkspaceItem): LifecycleAction[] {
  if (item.status === "prebooked") return ["send_quote", "request_deposit", "confirm_order", "cancel"];
  if (item.status === "quoted") return ["request_deposit", "confirm_order", "cancel"];
  if (item.status === "awaiting_deposit") return ["confirm_deposit", "confirm_order", "cancel"];
  if (item.status === "confirmed") {
    return item.payment_status === "paid"
      ? ["start_production", "cancel"]
      : ["confirm_payment", "start_production", "cancel"];
  }
  if (item.status === "in_production") {
    return item.payment_status === "paid"
      ? ["mark_ready", "cancel"]
      : ["confirm_payment", "mark_ready", "cancel"];
  }
  if (item.status === "ready") {
    return item.payment_status === "paid"
      ? ["complete", "cancel"]
      : ["confirm_payment", "cancel"];
  }
  if (item.status === "cancelled" && item.payment_status === "refund_pending") return ["confirm_refund"];
  return [];
}

const actionLabels: Record<LifecycleAction, string> = {
  send_quote: "Enviar orçamento",
  request_deposit: "Pedir sinal 50%",
  confirm_deposit: "Confirmar sinal",
  confirm_order: "Confirmar sem sinal",
  confirm_payment: "Confirmar pagamento",
  start_production: "Iniciar produção",
  mark_ready: "Marcar pronta",
  complete: "Concluir retirada",
  cancel: "Cancelar",
  confirm_refund: "Confirmar estorno",
};

function ActionIcon({ action }: { action: LifecycleAction }) {
  if (action === "send_quote" || action === "request_deposit") return <Send />;
  if (["confirm_deposit", "confirm_payment"].includes(action)) return <Banknote />;
  if (action === "start_production") return <ChefHat />;
  if (action === "mark_ready" || action === "complete" || action === "confirm_order") return <CheckCircle2 />;
  if (action === "confirm_refund") return <RotateCcw />;
  return <XCircle />;
}

export default function OperationServiceRequests() {
  const [items, setItems] = useState<ServiceRequestWorkspaceItem[]>([]);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [storeId, setStoreId] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<Record<string, string>>({});

  const loadStores = useCallback(async () => {
    try {
      const workspace = await bffRpc<BusinessWorkspace>("staff_get_business_workspace");
      setStores((workspace.stores || []).filter((store) => store.active));
    } catch {
      setStores([]);
    }
  }, []);

  const load = useCallback(async (nextSearch = search, nextStatus = status, nextStoreId = storeId) => {
    setLoading(true);
    setNotice("");
    try {
      const data = await bffRpc<ServiceRequestWorkspaceItem[]>("staff_get_service_request_workspace", {
        search_text: nextSearch.trim(),
        requested_status: nextStatus || null,
        result_limit: 80,
        target_store_id: nextStoreId || null,
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
  }, [search, status, storeId]);

  const runAction = useCallback(async (item: ServiceRequestWorkspaceItem, action: LifecycleAction) => {
    let note = "";
    if (action === "confirm_order") {
      const answer = window.prompt("Motivo da confirmação sem sinal (mínimo de 8 caracteres):", "Contingência aprovada pelo responsável");
      if (answer === null) return;
      note = answer.trim();
    }
    if (action === "cancel") {
      const answer = window.prompt("Informe o motivo do cancelamento (mínimo de 8 caracteres):", "");
      if (answer === null) return;
      note = answer.trim();
    }

    const needsPaymentMethod = ["confirm_deposit", "confirm_payment", "confirm_refund"].includes(action);
    const paymentMethod = selectedPaymentMethods[item.id] || "pix";
    setBusyId(item.id);
    setNotice("");
    try {
      const result = await bffRpc<LifecycleResult>("staff_transition_service_request", {
        target_request_id: item.id,
        operation_key: crypto.randomUUID(),
        requested_action: action,
        requested_deposit_fraction: 0.5,
        requested_payment_method: needsPaymentMethod ? paymentMethod : null,
        requested_note: note,
      });
      setNotice(
        `${result.request_number}: ${statusLabels[result.status] || result.status}` +
        (result.refund_required ? " · estorno pendente." : "."),
      );
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível concluir a ação da encomenda.");
    } finally {
      setBusyId("");
    }
  }, [load, selectedPaymentMethods]);

  useEffect(() => {
    void loadStores();
  }, [loadStores]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => void load(search, status, storeId),
      search.trim() ? 250 : 0,
    );
    return () => window.clearTimeout(timer);
  }, [search, status, storeId, load]);

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
          <p>Orçamento, sinal, produção, retirada e cancelamento em poucos toques, sempre vinculados à loja.</p>
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
        <label className="operation-service-requests-store-filter">
          <Store />
          <select
            value={storeId}
            onChange={(event) => setStoreId(event.target.value)}
            aria-label="Filtrar encomendas por loja"
          >
            <option value="">Todas as lojas acessíveis</option>
            {stores.map((store) => (
              <option value={store.id} key={store.id}>{store.name}</option>
            ))}
          </select>
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
          const total = Number(item.quoted_total ?? item.pricing?.total_price ?? item.configuration.estimated_price ?? 0);
          const paid = Number(item.paid_amount || 0);
          const remaining = Math.max(total - paid, 0);
          const actions = quickActions(item);
          const isBusy = busyId === item.id;
          const usesPaymentMethod = actions.some((action) =>
            ["confirm_deposit", "confirm_payment", "confirm_refund"].includes(action),
          );

          return (
            <article key={item.id} className={`status-${item.status}`} aria-busy={isBusy}>
              <header>
                <div>
                  <small>{item.request_number} · {item.store.name}</small>
                  <h3>{item.customer_name}</h3>
                  <p>{item.product.name} · {item.quantity} unidade(s)</p>
                </div>
                <span>{statusLabels[item.status] || item.status}</span>
              </header>

              <div className="operation-service-request-meta">
                <span><CalendarDays /><small>Data desejada</small><strong>{dateTime(item.desired_start)}</strong></span>
                <span><Clock3 /><small>Recebida em</small><strong>{dateTime(item.created_at)}</strong></span>
                <span><CircleDollarSign /><small>Total calculado</small><strong>{money(total)}</strong></span>
              </div>

              <div className="operation-service-request-payment">
                <span className={`payment-${item.payment_status || "pending"}`}>
                  <Banknote />
                  <small>{paymentStatusLabels[item.payment_status] || "Pagamento pendente"}</small>
                  <strong>{money(paid)} recebido · {money(remaining)} restante</strong>
                </span>
                {item.deposit_amount ? (
                  <span><small>Sinal calculado</small><strong>{money(item.deposit_amount)}</strong></span>
                ) : null}
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
              {item.cancellation_reason ? <p className="operation-service-request-cancellation"><strong>Cancelamento:</strong> {item.cancellation_reason}</p> : null}

              {actions.length ? (
                <section className="operation-service-request-actions" aria-label={`Ações da encomenda ${item.request_number}`}>
                  {usesPaymentMethod ? (
                    <label>
                      <small>Forma de pagamento</small>
                      <select
                        value={selectedPaymentMethods[item.id] || "pix"}
                        onChange={(event) => setSelectedPaymentMethods((current) => ({
                          ...current,
                          [item.id]: event.target.value,
                        }))}
                        disabled={isBusy}
                      >
                        {paymentMethods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </label>
                  ) : null}
                  <div>
                    {actions.map((action) => (
                      <button
                        type="button"
                        key={action}
                        className={action === "cancel" ? "danger" : action === "confirm_refund" ? "warning" : ""}
                        onClick={() => void runAction(item, action)}
                        disabled={isBusy}
                      >
                        <ActionIcon action={action} />
                        {isBusy ? "Processando…" : actionLabels[action]}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

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
