import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Calculator,
  CircleDollarSign,
  PackageCheck,
  RefreshCw,
  Save,
  Search,
} from "lucide-react";
import { bffRpc } from "./services/bff-rpc";
import {
  completeOperation,
  pendingOperationKey,
} from "./services/operation-idempotency";
import "./operation-product-profitability.css";

type CostOrigin =
  | "recipe_snapshot"
  | "manual_provisional"
  | "purchased"
  | "asset"
  | "service";

type DataStatus = "provisional" | "awaiting_validation" | "validated" | "blocked";

type RecipeVersion = {
  id: string;
  recipe_id: string;
  recipe_name: string;
  version_number: number;
  version_status: string;
  yield_quantity: number;
  yield_unit: string;
  latest_snapshot_id: string | null;
  latest_snapshot_cost: number | null;
  latest_snapshot_status: string | null;
  latest_snapshot_at: string | null;
};

type YieldOverride = {
  override_id: string;
  product_id: string;
  context_type: "action" | "event";
  context_key: string;
  context_label: string;
  active: boolean;
  valid_from: string;
  valid_until: string | null;
  yield_label: string;
  standard_yield_quantity: number;
  applied_yield_quantity: number;
  total_cost: number;
  cost_per_slice: number;
  authorized_slice_price: number;
  projected_total_revenue: number;
  gross_profit_per_slice: number;
  projected_gross_profit: number;
  margin: number;
  markup: number;
  minimum_margin: number;
  margin_alert: boolean;
};

type YieldSaleSnapshot = {
  id: string;
  sale_reference: string;
  applied_yield_quantity: number;
  yield_label: string;
  cost_per_slice: number;
  authorized_slice_price: number;
  margin: number;
  margin_alert: boolean;
  captured_at: string;
  idempotent: boolean;
};

type ProductProfitability = {
  id: string;
  name: string;
  slug: string;
  segment: string;
  subcategory: string | null;
  image_url: string | null;
  base_price: number | null;
  published: boolean;
  active: boolean;
  cost_origin: CostOrigin;
  recipe_version_id: string | null;
  cost_snapshot_id: string | null;
  manual_total_cost: number;
  sale_price_override: number | null;
  yield_quantity: number;
  yield_label: string;
  minimum_margin: number;
  data_status: DataStatus;
  notes: string;
  effective_total_cost: number;
  effective_sale_price: number;
  cost_per_yield: number;
  gross_profit: number;
  margin: number;
  markup: number;
  margin_alert: boolean;
  recipe_versions: RecipeVersion[];
  yield_overrides?: YieldOverride[];
};

type Workspace = {
  products: ProductProfitability[];
  selected_product_id: string | null;
  selected_product: ProductProfitability | null;
  summary: {
    total_products: number;
    configured_products: number;
    products_without_cost: number;
    margin_alerts: number;
    provisional_costs: number;
    active_yield_overrides?: number;
  };
};

type ProductForm = {
  productId: string;
  costOrigin: CostOrigin;
  recipeVersionId: string;
  costSnapshotId: string;
  manualTotalCost: number;
  salePriceOverride: string;
  yieldQuantity: number;
  yieldLabel: string;
  minimumMarginPercent: number;
  dataStatus: DataStatus;
  notes: string;
};

type YieldOverrideForm = {
  overrideId: string;
  contextType: "action" | "event";
  contextKey: string;
  contextLabel: string;
  yieldQuantity: number;
  requestedSlicePrice: string;
  active: boolean;
  validFrom: string;
  validUntil: string;
};

const emptyForm = (): ProductForm => ({
  productId: "",
  costOrigin: "manual_provisional",
  recipeVersionId: "",
  costSnapshotId: "",
  manualTotalCost: 0,
  salePriceOverride: "",
  yieldQuantity: 1,
  yieldLabel: "unidade",
  minimumMarginPercent: 30,
  dataStatus: "provisional",
  notes: "",
});

const emptyYieldOverrideForm = (): YieldOverrideForm => ({
  overrideId: "",
  contextType: "event",
  contextKey: "festival-de-fatias",
  contextLabel: "Festival de Fatias",
  yieldQuantity: 13,
  requestedSlicePrice: "",
  active: true,
  validFrom: "",
  validUntil: "",
});

const fromProduct = (product: ProductProfitability): ProductForm => ({
  productId: product.id,
  costOrigin: product.cost_origin,
  recipeVersionId: product.recipe_version_id || "",
  costSnapshotId: product.cost_snapshot_id || "",
  manualTotalCost: Number(product.manual_total_cost),
  salePriceOverride:
    product.sale_price_override === null ? "" : String(product.sale_price_override),
  yieldQuantity: Number(product.yield_quantity),
  yieldLabel: product.yield_label,
  minimumMarginPercent: Number(product.minimum_margin) * 100,
  dataStatus: product.data_status,
  notes: product.notes,
});

const toLocalDateTime = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const fromYieldOverride = (setting?: YieldOverride): YieldOverrideForm => {
  if (!setting) return emptyYieldOverrideForm();
  return {
    overrideId: setting.override_id,
    contextType: setting.context_type,
    contextKey: setting.context_key,
    contextLabel: setting.context_label,
    yieldQuantity: Number(setting.applied_yield_quantity),
    requestedSlicePrice: String(setting.authorized_slice_price),
    active: setting.active,
    validFrom: toLocalDateTime(setting.valid_from),
    validUntil: toLocalDateTime(setting.valid_until),
  };
};

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number.isFinite(value) ? value : 0,
  );

const percent = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 2 }).format(
    Number.isFinite(value) ? value : 0,
  );

const originLabels: Record<CostOrigin, string> = {
  recipe_snapshot: "Ficha técnica calculada",
  manual_provisional: "Custo provisório manual",
  purchased: "Produto comprado",
  asset: "Item de acervo",
  service: "Serviço ou recurso",
};

export default function OperationProductProfitability() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [yieldOverrideForm, setYieldOverrideForm] = useState<YieldOverrideForm>(
    emptyYieldOverrideForm,
  );
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [saleReference, setSaleReference] = useState("");
  const [lastSaleSnapshot, setLastSaleSnapshot] =
    useState<YieldSaleSnapshot | null>(null);

  const load = useCallback(async (query = "", requestedProductId?: string) => {
    setBusy(true);
    setNotice("");
    try {
      const next = await bffRpc<Workspace>("manager_get_product_profitability_workspace", {
        search_text: query || null,
        requested_product_id: requestedProductId || null,
      });
      setWorkspace(next);
      setForm(next.selected_product ? fromProduct(next.selected_product) : emptyForm());
      setYieldOverrideForm(
        fromYieldOverride(next.selected_product?.yield_overrides?.[0]),
      );
      setSaleReference("");
      setLastSaleSnapshot(null);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Não foi possível abrir a rentabilidade dos produtos.",
      );
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = workspace?.selected_product || null;
  const selectedRecipe = useMemo(
    () => selected?.recipe_versions.find((version) => version.id === form.recipeVersionId) || null,
    [form.recipeVersionId, selected?.recipe_versions],
  );

  const selectedYieldOverride = useMemo(
    () => selected?.yield_overrides?.find(
      (setting) => setting.override_id === yieldOverrideForm.overrideId,
    ) || null,
    [selected?.yield_overrides, yieldOverrideForm.overrideId],
  );

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.productId || busy) return;
    if (form.costOrigin === "recipe_snapshot" && !form.recipeVersionId) {
      setNotice("Selecione uma ficha técnica antes de usar o custo calculado.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const next = await bffRpc<Workspace>("manager_save_product_costing_settings", {
        target_product_id: form.productId,
        next_cost_origin: form.costOrigin,
        next_recipe_version_id:
          form.costOrigin === "recipe_snapshot" ? form.recipeVersionId || null : null,
        next_cost_snapshot_id:
          form.costOrigin === "recipe_snapshot" ? selectedRecipe?.latest_snapshot_id || null : null,
        next_manual_total_cost: form.manualTotalCost,
        next_sale_price_override:
          form.salePriceOverride === "" ? null : Number(form.salePriceOverride),
        next_yield_quantity: form.yieldQuantity,
        next_yield_label: form.yieldLabel,
        next_minimum_margin: form.minimumMarginPercent / 100,
        next_data_status: form.dataStatus,
        next_notes: form.notes,
      });
      setWorkspace(next);
      if (next.selected_product) setForm(fromProduct(next.selected_product));
      setNotice("Custo, preço e margem do produto foram atualizados.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível salvar o produto.");
    } finally {
      setBusy(false);
    }
  };

  const saveYieldOverride = async () => {
    if (!form.productId || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const next = await bffRpc<Workspace>("manager_save_product_yield_override", {
        target_product_id: form.productId,
        target_override_id: yieldOverrideForm.overrideId || null,
        next_context_type: yieldOverrideForm.contextType,
        next_context_key: yieldOverrideForm.contextKey,
        next_context_label: yieldOverrideForm.contextLabel,
        next_yield_quantity: yieldOverrideForm.yieldQuantity,
        requested_slice_price: Number(yieldOverrideForm.requestedSlicePrice),
        next_active: yieldOverrideForm.active,
        next_valid_from: yieldOverrideForm.validFrom
          ? new Date(yieldOverrideForm.validFrom).toISOString()
          : null,
        next_valid_until: yieldOverrideForm.validUntil
          ? new Date(yieldOverrideForm.validUntil).toISOString()
          : null,
      });
      setWorkspace(next);
      if (next.selected_product) {
        setForm(fromProduct(next.selected_product));
        const saved = next.selected_product.yield_overrides?.find(
          (setting) => setting.override_id === yieldOverrideForm.overrideId
            || (
              setting.context_type === yieldOverrideForm.contextType
              && setting.context_key === yieldOverrideForm.contextKey.trim().toLowerCase()
            ),
        );
        setYieldOverrideForm(fromYieldOverride(saved));
      }
      setNotice("Rendimento e preço por fatia recalculados e autorizados pelo servidor.");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o rendimento do evento.",
      );
    } finally {
      setBusy(false);
    }
  };

  const captureYieldSaleSnapshot = async () => {
    if (!form.productId || !selectedYieldOverride || busy) return;
    const normalizedSaleReference = saleReference.trim();
    if (normalizedSaleReference.length < 2) {
      setNotice("Informe a referência da venda antes de registrar o snapshot.");
      return;
    }

    const payload = {
      target_product_id: form.productId,
      target_context_type: selectedYieldOverride.context_type,
      target_context_key: selectedYieldOverride.context_key,
      target_sale_reference: normalizedSaleReference,
    };
    const operation = pendingOperationKey(
      "festival-yield-sale-snapshot",
      payload,
    );

    setBusy(true);
    setNotice("");
    try {
      const snapshot = await bffRpc<YieldSaleSnapshot>(
        "manager_capture_product_yield_sale_snapshot",
        {
          ...payload,
          operation_key: operation.value,
        },
      );
      completeOperation(operation.fingerprint);
      setLastSaleSnapshot(snapshot);
      setNotice(
        snapshot.idempotent
          ? "O snapshot desta venda já estava registrado e foi recuperado."
          : "Snapshot financeiro imutável da venda registrado pelo servidor.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Não foi possível registrar o snapshot da venda.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="operation-product-profitability">
      <header className="operation-product-profitability-heading">
        <div>
          <small>Produtos fixos e tortas cadastradas</small>
          <h2>Rentabilidade dos produtos</h2>
          <p>Veja custo, preço, lucro, margem e alertas sem expor dados internos ao cliente.</p>
        </div>
        <Calculator />
      </header>

      {workspace ? (
        <div className="operation-product-profitability-summary">
          <span><PackageCheck /><small>Produtos</small><strong>{workspace.summary.total_products}</strong></span>
          <span><CircleDollarSign /><small>Com custo</small><strong>{workspace.summary.configured_products}</strong></span>
          <span className={workspace.summary.products_without_cost ? "warning" : ""}><AlertTriangle /><small>Sem custo</small><strong>{workspace.summary.products_without_cost}</strong></span>
          <span className={workspace.summary.margin_alerts ? "danger" : ""}><AlertTriangle /><small>Margem baixa</small><strong>{workspace.summary.margin_alerts}</strong></span>
        </div>
      ) : null}

      <form
        className="operation-product-profitability-search"
        onSubmit={(event) => {
          event.preventDefault();
          void load(search);
        }}
      >
        <label>
          <Search />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar torta, produto ou categoria"
          />
        </label>
        <button type="submit" disabled={busy}>Buscar</button>
        <button type="button" onClick={() => void load()} disabled={busy} aria-label="Atualizar">
          <RefreshCw />
        </button>
      </form>

      {notice ? <p className="operation-product-profitability-notice" role="status">{notice}</p> : null}

      <div className="operation-product-profitability-layout">
        <nav aria-label="Produtos cadastrados">
          {(workspace?.products || []).map((product) => (
            <button
              type="button"
              key={product.id}
              className={product.id === form.productId ? "active" : ""}
              onClick={() => void load(search, product.id)}
            >
              <img src={product.image_url || "/site/placeholder-produto-sem-foto.svg"} alt="" />
              <span>
                <strong>{product.name}</strong>
                <small>{originLabels[product.cost_origin]}</small>
                <b>{money(product.effective_sale_price)}</b>
              </span>
              <em className={product.margin_alert ? "danger" : product.effective_total_cost > 0 ? "ok" : "warning"}>
                {product.effective_total_cost > 0 ? percent(product.margin) : "sem custo"}
              </em>
            </button>
          ))}
        </nav>

        {selected ? (
          <form className="operation-product-profitability-form" onSubmit={save}>
            <header>
              <img src={selected.image_url || "/site/placeholder-produto-sem-foto.svg"} alt="" />
              <div><small>{selected.segment}</small><h3>{selected.name}</h3><p>Preço atual no catálogo: {money(Number(selected.base_price || 0))}</p></div>
            </header>

            <div className="operation-product-profitability-metrics">
              <span><small>Custo total</small><strong>{money(selected.effective_total_cost)}</strong></span>
              <span><small>Preço usado</small><strong>{money(selected.effective_sale_price)}</strong></span>
              <span><small>Lucro bruto</small><strong>{money(selected.gross_profit)}</strong></span>
              <span className={selected.margin_alert ? "danger" : "ok"}><small>Margem</small><strong>{percent(selected.margin)}</strong></span>
              <span><small>Markup</small><strong>{Number(selected.markup).toFixed(2)}x</strong></span>
              <span><small>Custo por {selected.yield_label || "unidade"}</small><strong>{money(selected.cost_per_yield)}</strong></span>
            </div>

            <div className="operation-product-profitability-grid">
              <label>
                Origem do custo
                <select value={form.costOrigin} onChange={(event) => setForm({ ...form, costOrigin: event.target.value as CostOrigin })}>
                  {Object.entries(originLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>

              {form.costOrigin === "recipe_snapshot" ? (
                <label className="wide">
                  Ficha técnica
                  <select
                    value={form.recipeVersionId}
                    onChange={(event) => {
                      const version = selected.recipe_versions.find((item) => item.id === event.target.value);
                      setForm({
                        ...form,
                        recipeVersionId: event.target.value,
                        costSnapshotId: version?.latest_snapshot_id || "",
                      });
                    }}
                  >
                    <option value="">Selecione uma ficha técnica</option>
                    {selected.recipe_versions.map((version) => (
                      <option key={version.id} value={version.id}>
                        {version.recipe_name} · versão {version.version_number} · {version.latest_snapshot_cost === null ? "sem cálculo" : money(Number(version.latest_snapshot_cost))}
                      </option>
                    ))}
                  </select>
                  <small>Somente snapshots internos calculados pelo servidor podem definir o custo.</small>
                </label>
              ) : (
                <label>
                  Custo total provisório
                  <input type="number" min="0" step="0.01" value={form.manualTotalCost} onChange={(event) => setForm({ ...form, manualTotalCost: Number(event.target.value) })} />
                </label>
              )}

              <label>
                Preço de venda específico <small>(opcional)</small>
                <input type="number" min="0" step="0.01" value={form.salePriceOverride} onChange={(event) => setForm({ ...form, salePriceOverride: event.target.value })} placeholder="Usar preço do catálogo" />
              </label>
              <label>
                Rendimento
                <input type="number" min="0.0001" step="0.01" value={form.yieldQuantity} onChange={(event) => setForm({ ...form, yieldQuantity: Number(event.target.value) })} />
              </label>
              <label>
                Unidade do rendimento
                <input value={form.yieldLabel} onChange={(event) => setForm({ ...form, yieldLabel: event.target.value })} placeholder="fatias, unidades..." />
              </label>
              <label>
                Margem mínima (%)
                <input type="number" min="0" max="99.99" step="0.01" value={form.minimumMarginPercent} onChange={(event) => setForm({ ...form, minimumMarginPercent: Number(event.target.value) })} />
              </label>
              <label>
                Status do custo
                <select value={form.dataStatus} onChange={(event) => setForm({ ...form, dataStatus: event.target.value as DataStatus })}>
                  <option value="provisional">Provisório</option>
                  <option value="awaiting_validation">Aguardando validação</option>
                  <option value="validated">Validado</option>
                  <option value="blocked">Bloqueado para revisão</option>
                </select>
              </label>
              <label className="wide">
                Observações internas
                <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Origem do custo, pendências e critérios usados." />
              </label>
            </div>

            {selected.margin_alert ? (
              <p className="operation-product-profitability-alert"><AlertTriangle /> A margem estimada está abaixo do mínimo configurado.</p>
            ) : null}

            <section aria-labelledby="festival-slice-heading">
              <header>
                <div>
                  <small>Ação ou evento sem duplicar o produto</small>
                  <h3 id="festival-slice-heading">Festival de Fatias</h3>
                  <p>O rendimento padrão permanece no produto. Este bloco registra somente a exceção e o preço por fatia autorizado.</p>
                </div>
              </header>

              <div className="operation-product-profitability-grid">
                <label className="wide">
                  Configuração existente
                  <select
                    value={yieldOverrideForm.overrideId}
                    onChange={(event) => {
                      const setting = selected.yield_overrides?.find(
                        (item) => item.override_id === event.target.value,
                      );
                      setYieldOverrideForm(fromYieldOverride(setting));
                    }}
                  >
                    <option value="">Nova ação ou evento</option>
                    {(selected.yield_overrides || []).map((setting) => (
                      <option key={setting.override_id} value={setting.override_id}>
                        {setting.context_label} · {setting.active ? "ativa" : "inativa"}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Tipo de contexto
                  <select
                    value={yieldOverrideForm.contextType}
                    onChange={(event) => setYieldOverrideForm({
                      ...yieldOverrideForm,
                      contextType: event.target.value as "action" | "event",
                    })}
                  >
                    <option value="event">Evento</option>
                    <option value="action">Ação</option>
                  </select>
                </label>
                <label>
                  Chave do contexto
                  <input
                    value={yieldOverrideForm.contextKey}
                    onChange={(event) => setYieldOverrideForm({
                      ...yieldOverrideForm,
                      contextKey: event.target.value,
                    })}
                    placeholder="festival-de-fatias"
                  />
                </label>
                <label className="wide">
                  Nome da ação ou evento
                  <input
                    value={yieldOverrideForm.contextLabel}
                    onChange={(event) => setYieldOverrideForm({
                      ...yieldOverrideForm,
                      contextLabel: event.target.value,
                    })}
                    placeholder="Festival de Fatias"
                  />
                </label>
                <label>
                  Rendimento padrão
                  <input value={`${selected.yield_quantity} ${selected.yield_label}`} readOnly />
                </label>
                <label>
                  Rendimento no evento
                  <input
                    type="number"
                    min="0.0001"
                    step="0.01"
                    value={yieldOverrideForm.yieldQuantity}
                    onChange={(event) => setYieldOverrideForm({
                      ...yieldOverrideForm,
                      yieldQuantity: Number(event.target.value),
                    })}
                  />
                </label>
                <label>
                  Preço por fatia proposto
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={yieldOverrideForm.requestedSlicePrice}
                    onChange={(event) => setYieldOverrideForm({
                      ...yieldOverrideForm,
                      requestedSlicePrice: event.target.value,
                    })}
                    placeholder="0,00"
                  />
                </label>
                <label>
                  Início da validade
                  <input
                    type="datetime-local"
                    value={yieldOverrideForm.validFrom}
                    onChange={(event) => setYieldOverrideForm({
                      ...yieldOverrideForm,
                      validFrom: event.target.value,
                    })}
                  />
                </label>
                <label>
                  Fim da validade <small>(opcional)</small>
                  <input
                    type="datetime-local"
                    value={yieldOverrideForm.validUntil}
                    onChange={(event) => setYieldOverrideForm({
                      ...yieldOverrideForm,
                      validUntil: event.target.value,
                    })}
                  />
                </label>
                <label>
                  Configuração ativa
                  <input
                    type="checkbox"
                    checked={yieldOverrideForm.active}
                    onChange={(event) => setYieldOverrideForm({
                      ...yieldOverrideForm,
                      active: event.target.checked,
                    })}
                  />
                </label>
              </div>

              {selectedYieldOverride ? (
                <>
                  <div className="operation-product-profitability-metrics">
                    <span><small>Custo total</small><strong>{money(selectedYieldOverride.total_cost)}</strong></span>
                    <span><small>Custo por fatia</small><strong>{money(selectedYieldOverride.cost_per_slice)}</strong></span>
                    <span><small>Preço por fatia autorizado</small><strong>{money(selectedYieldOverride.authorized_slice_price)}</strong></span>
                    <span><small>Lucro por fatia</small><strong>{money(selectedYieldOverride.gross_profit_per_slice)}</strong></span>
                    <span className={selectedYieldOverride.margin_alert ? "danger" : "ok"}><small>Margem</small><strong>{percent(selectedYieldOverride.margin)}</strong></span>
                    <span><small>Markup</small><strong>{Number(selectedYieldOverride.markup).toFixed(2)}x</strong></span>
                  </div>
                  {selectedYieldOverride.margin_alert ? (
                    <p className="operation-product-profitability-alert"><AlertTriangle /> A margem das fatias está abaixo do mínimo do produto.</p>
                  ) : null}

                  <div className="operation-product-profitability-grid">
                    <label className="wide">
                      Referência da venda
                      <input
                        value={saleReference}
                        onChange={(event) => setSaleReference(event.target.value)}
                        placeholder="Número do pedido, venda ou comprovante"
                        maxLength={160}
                      />
                      <small>O servidor congela rendimento, custo e preço autorizados usados nesta venda.</small>
                    </label>
                  </div>

                  <button
                    type="button"
                    disabled={busy || saleReference.trim().length < 2}
                    onClick={() => void captureYieldSaleSnapshot()}
                  >
                    <PackageCheck /> {busy ? "Registrando…" : "Registrar snapshot da venda"}
                  </button>

                  {lastSaleSnapshot ? (
                    <p role="status">
                      Venda {lastSaleSnapshot.sale_reference}:{" "}
                      {lastSaleSnapshot.applied_yield_quantity} {lastSaleSnapshot.yield_label},{" "}
                      custo {money(lastSaleSnapshot.cost_per_slice)} e preço{" "}
                      {money(lastSaleSnapshot.authorized_slice_price)} por fatia.
                    </p>
                  ) : null}
                </>
              ) : (
                <p>Salve a configuração para receber o cálculo financeiro do servidor.</p>
              )}

              <button type="button" disabled={busy} onClick={() => void saveYieldOverride()}>
                <Save /> {busy ? "Salvando…" : "Salvar rendimento do evento"}
              </button>
            </section>

            <footer>
              <p>Os valores exibidos são os últimos cálculos do servidor. O cliente nunca recebe custo, lucro ou margem.</p>
              <button type="submit" disabled={busy}><Save /> {busy ? "Salvando…" : "Salvar rentabilidade"}</button>
            </footer>
          </form>
        ) : <p>Nenhum produto encontrado.</p>}
      </div>
    </section>
  );
}
