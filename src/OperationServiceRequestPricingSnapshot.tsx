import { FormEvent, useMemo, useState } from "react";
import {
  AlertTriangle,
  CircleDollarSign,
  Clock3,
  History,
  Layers3,
  Search,
  ShieldCheck,
} from "lucide-react";
import { bffRpc } from "./services/bff-rpc";
import "./operation-service-request-pricing-snapshot.css";

type PricingSnapshot = {
  request_id: string;
  product_id: string;
  requested_quantity: number;
  currency: "BRL";
  unit_cost: number;
  unit_price: number;
  total_cost: number;
  total_price: number;
  gross_profit: number;
  margin: number;
  markup: number;
  minimum_margin: number;
  margin_alert: boolean;
  cost_origin: string;
  data_status: string;
  recipe_version_id: string | null;
  cost_snapshot_id: string | null;
  selection_snapshot: Record<string, unknown>;
  calculation_snapshot: Record<string, unknown>;
  captured_at: string;
};

type SelectionGroup = { group: string; labels: string[] };

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0);

const percent = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "percent",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0);

const statusLabels: Record<string, string> = {
  provisional: "Provisório",
  awaiting_validation: "Aguardando validação",
  validated: "Validado",
  blocked: "Bloqueado",
};

const originLabels: Record<string, string> = {
  recipe_snapshot: "Ficha técnica calculada",
  manual_provisional: "Custo provisório manual",
  purchased: "Produto comprado",
  asset: "Item de acervo",
  service: "Serviço ou recurso",
};

const stringList = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim() !== "")
    : typeof value === "string" && value.trim() !== ""
      ? [value]
      : [];

function selectedLabels(selection: Record<string, unknown>): SelectionGroup[] {
  const groups: SelectionGroup[] = [];
  const cakeSummary = selection.cake_builder_summary;
  if (cakeSummary && typeof cakeSummary === "object" && !Array.isArray(cakeSummary)) {
    for (const [group, value] of Object.entries(cakeSummary as Record<string, unknown>)) {
      const labels = stringList(value);
      if (labels.length) groups.push({ group, labels });
    }
  }

  const productSummary = stringList(selection.product_configuration_summary);
  if (productSummary.length) {
    groups.push({ group: "product_configuration", labels: productSummary });
  } else {
    const configuration = selection.product_configuration;
    const items = configuration && typeof configuration === "object" && !Array.isArray(configuration)
      ? (configuration as Record<string, unknown>).items
      : null;
    if (Array.isArray(items)) {
      const labels = items.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const record = item as Record<string, unknown>;
        const label = typeof record.label === "string" ? record.label.trim() : "";
        const quantity = Number(record.quantity);
        return label && Number.isInteger(quantity) && quantity > 0
          ? [`${quantity}× ${label}`]
          : [];
      });
      if (labels.length) groups.push({ group: "product_configuration", labels });
    }
  }
  return groups;
}

const groupLabels: Record<string, string> = {
  cake_layers: "Camadas de bolo",
  filling_layers: "Camadas de recheio",
  topping: "Cobertura",
  filling_fruits: "Frutas no recheio",
  topping_fruits: "Frutas na cobertura",
  filling_extras: "Adicionais no recheio",
  topping_extras: "Adicionais na cobertura",
  product_configuration: "Sabores, variações e adicionais",
};

export default function OperationServiceRequestPricingSnapshot() {
  const [requestId, setRequestId] = useState("");
  const [snapshot, setSnapshot] = useState<PricingSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const selections = useMemo(
    () => (snapshot ? selectedLabels(snapshot.selection_snapshot || {}) : []),
    [snapshot],
  );

  const product = useMemo(() => {
    const value = snapshot?.calculation_snapshot?.product;
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }, [snapshot]);

  const lookup = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = requestId.trim();
    if (!UUID.test(normalized)) {
      setSnapshot(null);
      setNotice("Cole o identificador completo da encomenda.");
      return;
    }

    setBusy(true);
    setNotice("");
    try {
      const result = await bffRpc<PricingSnapshot | null>(
        "manager_get_service_request_pricing_snapshot",
        { target_request_id: normalized },
      );
      setSnapshot(result);
      setNotice(
        result
          ? "Snapshot histórico localizado. Os valores e escolhas abaixo não mudam quando o produto for atualizado."
          : "Esta encomenda ainda não possui snapshot financeiro.",
      );
    } catch (error) {
      setSnapshot(null);
      setNotice(
        error instanceof Error
          ? error.message
          : "Não foi possível consultar o snapshot da encomenda.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="operation-request-pricing-snapshot">
      <header className="operation-request-pricing-snapshot-heading">
        <div>
          <small>Histórico protegido</small>
          <h2>Valores e escolhas usados na encomenda</h2>
          <p>
            Consulte custo, preço, margem, sabores, quantidades e adicionais congelados
            no momento em que a solicitação foi registrada.
          </p>
        </div>
        <History />
      </header>

      <form className="operation-request-pricing-snapshot-search" onSubmit={lookup}>
        <label>
          Identificador da encomenda
          <span>
            <Search />
            <input
              value={requestId}
              onChange={(event) => setRequestId(event.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
              autoComplete="off"
              spellCheck={false}
            />
          </span>
        </label>
        <button type="submit" disabled={busy}>
          {busy ? "Consultando…" : "Consultar encomenda"}
        </button>
      </form>

      {notice ? (
        <p className="operation-request-pricing-snapshot-notice" role="status">
          {notice}
        </p>
      ) : null}

      {snapshot ? (
        <div className="operation-request-pricing-snapshot-result">
          <header>
            <div>
              <small>{originLabels[snapshot.cost_origin] || snapshot.cost_origin}</small>
              <h3>{String(product?.name || "Produto da encomenda")}</h3>
              <p>
                {snapshot.requested_quantity} unidade(s) · capturado em{" "}
                {new Date(snapshot.captured_at).toLocaleString("pt-BR")}
              </p>
            </div>
            <span className={snapshot.margin_alert ? "danger" : "ok"}>
              {snapshot.margin_alert ? <AlertTriangle /> : <ShieldCheck />}
              {snapshot.margin_alert ? "Margem abaixo do mínimo" : "Margem protegida"}
            </span>
          </header>

          <div className="operation-request-pricing-snapshot-metrics">
            <span><small>Custo unitário</small><strong>{money(snapshot.unit_cost)}</strong></span>
            <span><small>Preço unitário</small><strong>{money(snapshot.unit_price)}</strong></span>
            <span><small>Custo total</small><strong>{money(snapshot.total_cost)}</strong></span>
            <span><small>Valor total</small><strong>{money(snapshot.total_price)}</strong></span>
            <span><small>Lucro bruto</small><strong>{money(snapshot.gross_profit)}</strong></span>
            <span className={snapshot.margin_alert ? "danger" : "ok"}><small>Margem</small><strong>{percent(snapshot.margin)}</strong></span>
            <span><small>Markup</small><strong>{Number(snapshot.markup).toFixed(2)}x</strong></span>
            <span><small>Margem mínima</small><strong>{percent(snapshot.minimum_margin)}</strong></span>
          </div>

          <div className="operation-request-pricing-snapshot-evidence">
            <span><CircleDollarSign /><div><small>Status do custo</small><strong>{statusLabels[snapshot.data_status] || snapshot.data_status}</strong></div></span>
            <span><Clock3 /><div><small>Data imutável</small><strong>{new Date(snapshot.captured_at).toLocaleDateString("pt-BR")}</strong></div></span>
            <span><ShieldCheck /><div><small>Snapshot técnico</small><strong>{snapshot.cost_snapshot_id ? "Vinculado" : "Custo administrativo"}</strong></div></span>
          </div>

          {selections.length ? (
            <section className="operation-request-pricing-snapshot-selections">
              <header><Layers3 /><div><small>Pedido estruturado</small><h4>Composição registrada</h4></div></header>
              <div>
                {selections.map((selection) => (
                  <span key={selection.group}>
                    <small>{groupLabels[selection.group] || selection.group}</small>
                    <strong>{selection.labels.join(", ")}</strong>
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          <footer>
            <ShieldCheck />
            <p>
              Este registro não é recalculado. Alterações posteriores em ingredientes,
              opções, fichas técnicas ou preços não modificam a encomenda histórica.
            </p>
          </footer>
        </div>
      ) : null}
    </section>
  );
}
