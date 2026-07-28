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
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

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

  const preview = useMemo(() => {
    const recipeCost = Number(selectedRecipe?.latest_snapshot_cost || 0);
    const cost = form.costOrigin === "recipe_snapshot" ? recipeCost : form.manualTotalCost;
    const salePrice = form.salePriceOverride === ""
      ? Number(selected?.base_price || 0)
      : Number(form.salePriceOverride || 0);
    const profit = salePrice - cost;
    const margin = salePrice > 0 ? profit / salePrice : 0;
    return {
      cost,
      salePrice,
      profit,
      margin,
      markup: cost > 0 ? salePrice / cost : 0,
      costPerYield: cost / Math.max(form.yieldQuantity, 1),
    };
  }, [form, selected?.base_price, selectedRecipe?.latest_snapshot_cost]);

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
              <span><small>Custo total</small><strong>{money(preview.cost)}</strong></span>
              <span><small>Preço usado</small><strong>{money(preview.salePrice)}</strong></span>
              <span><small>Lucro bruto</small><strong>{money(preview.profit)}</strong></span>
              <span className={preview.margin < form.minimumMarginPercent / 100 ? "danger" : "ok"}><small>Margem</small><strong>{percent(preview.margin)}</strong></span>
              <span><small>Markup</small><strong>{preview.markup.toFixed(2)}x</strong></span>
              <span><small>Custo por {form.yieldLabel || "unidade"}</small><strong>{money(preview.costPerYield)}</strong></span>
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

            {preview.margin < form.minimumMarginPercent / 100 ? (
              <p className="operation-product-profitability-alert"><AlertTriangle /> A margem estimada está abaixo do mínimo configurado.</p>
            ) : null}

            <footer>
              <p>O cliente nunca recebe custo, lucro ou margem. O backend continua sendo a fonte de verdade.</p>
              <button type="submit" disabled={busy}><Save /> {busy ? "Salvando…" : "Salvar rentabilidade"}</button>
            </footer>
          </form>
        ) : <p>Nenhum produto encontrado.</p>}
      </div>
    </section>
  );
}
