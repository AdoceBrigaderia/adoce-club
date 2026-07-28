import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Calculator,
  CircleDollarSign,
  PackagePlus,
  Plus,
  RefreshCw,
  Save,
  Search,
} from "lucide-react";
import { bffRpc } from "./services/bff-rpc";
import "./operation-cost-catalog.css";

type CostOrigin =
  | "manufactured"
  | "purchased"
  | "asset"
  | "service"
  | "manual_provisional";

type CommercialStatus = "draft" | "internal" | "selected_customers" | "public" | "blocked";
type DataStatus = "provisional" | "awaiting_validation" | "validated" | "blocked";

type CostItem = {
  id: string;
  internal_code: string;
  name: string;
  item_kind: string;
  category: string;
  brand: string;
  supplier: string;
  purchase_unit: string;
  package_quantity: number;
  consumption_unit: string;
  default_loss_percent: number;
  data_status: DataStatus;
  active: boolean;
  cost_origin: CostOrigin;
  manual_unit_cost: number;
  effective_unit_cost: number;
  sale_price: number;
  gross_profit: number;
  margin: number;
  markup: number;
  minimum_margin: number;
  margin_alert: boolean;
  acquisition_cost: number;
  expected_uses: number;
  maintenance_per_use: number;
  cleaning_per_use: number;
  replacement_reserve_per_use: number;
  commercial_status: CommercialStatus;
  notes: string;
  latest_purchase_price: null | {
    purchase_price: number;
    purchased_quantity: number;
    purchase_unit: string;
    useful_quantity: number | null;
    net_unit_cost: number;
    effective_at: string;
    data_status: DataStatus;
    source_note: string;
  };
};

type Workspace = {
  items: CostItem[];
  selected_item_id: string | null;
  selected_item: CostItem | null;
  summary: {
    total_items: number;
    public_items: number;
    margin_alerts: number;
    provisional_costs: number;
  };
};

type ItemForm = {
  id: string;
  internalCode: string;
  name: string;
  itemKind: string;
  category: string;
  brand: string;
  supplier: string;
  purchaseUnit: string;
  packageQuantity: number;
  consumptionUnit: string;
  lossPercent: number;
  dataStatus: DataStatus;
  active: boolean;
  costOrigin: CostOrigin;
  manualUnitCost: number;
  salePrice: number;
  minimumMarginPercent: number;
  acquisitionCost: number;
  expectedUses: number;
  maintenancePerUse: number;
  cleaningPerUse: number;
  replacementReservePerUse: number;
  commercialStatus: CommercialStatus;
  notes: string;
};

type PriceForm = {
  purchasePrice: number;
  purchasedQuantity: number;
  purchaseUnit: string;
  usefulQuantity: string;
  dataStatus: DataStatus;
  sourceNote: string;
};

const emptyItem = (): ItemForm => ({
  id: "",
  internalCode: "",
  name: "",
  itemKind: "ingredient",
  category: "",
  brand: "",
  supplier: "",
  purchaseUnit: "unit",
  packageQuantity: 1,
  consumptionUnit: "unit",
  lossPercent: 0,
  dataStatus: "provisional",
  active: true,
  costOrigin: "manual_provisional",
  manualUnitCost: 0,
  salePrice: 0,
  minimumMarginPercent: 30,
  acquisitionCost: 0,
  expectedUses: 1,
  maintenancePerUse: 0,
  cleaningPerUse: 0,
  replacementReservePerUse: 0,
  commercialStatus: "draft",
  notes: "",
});

const emptyPrice = (): PriceForm => ({
  purchasePrice: 0,
  purchasedQuantity: 1,
  purchaseUnit: "unit",
  usefulQuantity: "",
  dataStatus: "provisional",
  sourceNote: "",
});

const fromItem = (item: CostItem): ItemForm => ({
  id: item.id,
  internalCode: item.internal_code,
  name: item.name,
  itemKind: item.item_kind,
  category: item.category,
  brand: item.brand,
  supplier: item.supplier,
  purchaseUnit: item.purchase_unit,
  packageQuantity: Number(item.package_quantity),
  consumptionUnit: item.consumption_unit,
  lossPercent: Number(item.default_loss_percent),
  dataStatus: item.data_status,
  active: item.active,
  costOrigin: item.cost_origin,
  manualUnitCost: Number(item.manual_unit_cost),
  salePrice: Number(item.sale_price),
  minimumMarginPercent: Number(item.minimum_margin) * 100,
  acquisitionCost: Number(item.acquisition_cost),
  expectedUses: Number(item.expected_uses),
  maintenancePerUse: Number(item.maintenance_per_use),
  cleaningPerUse: Number(item.cleaning_per_use),
  replacementReservePerUse: Number(item.replacement_reserve_per_use),
  commercialStatus: item.commercial_status,
  notes: item.notes,
});

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number.isFinite(value) ? value : 0,
  );

const percent = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 2 }).format(
    Number.isFinite(value) ? value : 0,
  );

export default function OperationCostCatalog() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [form, setForm] = useState<ItemForm>(emptyItem);
  const [priceForm, setPriceForm] = useState<PriceForm>(emptyPrice);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async (query = "", requestedItemId?: string) => {
    setBusy(true);
    setNotice("");
    try {
      const next = await bffRpc<Workspace>("manager_get_costing_catalog_workspace", {
        search_text: query || null,
        requested_item_id: requestedItemId || null,
      });
      setWorkspace(next);
      if (next.selected_item) {
        setForm(fromItem(next.selected_item));
        setPriceForm((current) => ({
          ...current,
          purchaseUnit: next.selected_item?.purchase_unit || current.purchaseUnit,
        }));
      } else {
        setForm(emptyItem());
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível abrir custos e margens.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const preview = useMemo(() => {
    const cost = form.costOrigin === "asset"
      ? form.acquisitionCost / Math.max(form.expectedUses, 1) +
        form.maintenancePerUse +
        form.cleaningPerUse +
        form.replacementReservePerUse
      : form.costOrigin === "purchased" && workspace?.selected_item?.latest_purchase_price
        ? Number(workspace.selected_item.latest_purchase_price.net_unit_cost)
        : form.manualUnitCost;
    const profit = form.salePrice - cost;
    const margin = form.salePrice > 0 ? profit / form.salePrice : 0;
    return { cost, profit, margin, markup: cost > 0 ? form.salePrice / cost : 0 };
  }, [form, workspace?.selected_item?.latest_purchase_price]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      const next = await bffRpc<Workspace>("manager_save_costing_catalog_item", {
        target_item_id: form.id || null,
        next_internal_code: form.internalCode,
        next_name: form.name,
        next_item_kind: form.itemKind,
        next_category: form.category,
        next_brand: form.brand,
        next_supplier: form.supplier,
        next_purchase_unit: form.purchaseUnit,
        next_package_quantity: form.packageQuantity,
        next_consumption_unit: form.consumptionUnit,
        next_default_loss_percent: form.lossPercent,
        next_data_status: form.dataStatus,
        next_active: form.active,
        next_cost_origin: form.costOrigin,
        next_manual_unit_cost: form.manualUnitCost,
        next_sale_price: form.salePrice,
        next_minimum_margin: form.minimumMarginPercent / 100,
        next_acquisition_cost: form.acquisitionCost,
        next_expected_uses: form.expectedUses,
        next_maintenance_per_use: form.maintenancePerUse,
        next_cleaning_per_use: form.cleaningPerUse,
        next_replacement_reserve_per_use: form.replacementReservePerUse,
        next_commercial_status: form.commercialStatus,
        next_notes: form.notes,
      });
      setWorkspace(next);
      if (next.selected_item) setForm(fromItem(next.selected_item));
      setNotice("Item salvo. Custo, preço, lucro e margem foram recalculados no servidor.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível salvar o item.");
    } finally {
      setBusy(false);
    }
  };

  const addPrice = async () => {
    if (!form.id || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const next = await bffRpc<Workspace>("manager_add_costing_item_price", {
        target_item_id: form.id,
        next_purchase_price: priceForm.purchasePrice,
        next_purchased_quantity: priceForm.purchasedQuantity,
        next_purchase_unit: priceForm.purchaseUnit,
        next_useful_quantity: priceForm.usefulQuantity === "" ? null : Number(priceForm.usefulQuantity),
        next_data_status: priceForm.dataStatus,
        next_source_note: priceForm.sourceNote,
      });
      setWorkspace(next);
      if (next.selected_item) setForm(fromItem(next.selected_item));
      setPriceForm(emptyPrice());
      setNotice("Preço de compra registrado no histórico. O custo efetivo foi atualizado.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível registrar o preço.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="operation-cost-catalog" aria-labelledby="cost-catalog-title">
      <header className="operation-cost-catalog-heading">
        <div>
          <small>Custos e Produção</small>
          <h2 id="cost-catalog-title">Itens, preços e margens</h2>
          <p>Cadastre fabricação própria, compras, acervo e serviços sem fazer contas manualmente.</p>
        </div>
        <Calculator aria-hidden="true" />
      </header>

      {notice ? <p className="operation-cost-catalog-notice" role="status">{notice}</p> : null}

      <div className="operation-cost-catalog-summary">
        <article><strong>{workspace?.summary.total_items || 0}</strong><span>itens</span></article>
        <article><strong>{workspace?.summary.public_items || 0}</strong><span>publicados</span></article>
        <article className={(workspace?.summary.margin_alerts || 0) > 0 ? "alert" : ""}><strong>{workspace?.summary.margin_alerts || 0}</strong><span>alertas de margem</span></article>
        <article><strong>{workspace?.summary.provisional_costs || 0}</strong><span>custos provisórios</span></article>
      </div>

      <div className="operation-cost-catalog-layout">
        <aside>
          <form className="operation-cost-catalog-search" onSubmit={(event) => { event.preventDefault(); void load(search); }}>
            <Search />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar item, código ou categoria" />
            <button type="submit" disabled={busy}>Buscar</button>
          </form>
          <button type="button" className="operation-cost-catalog-new" onClick={() => { setForm(emptyItem()); setNotice(""); }}>
            <Plus /> Novo item
          </button>
          <div className="operation-cost-catalog-list">
            {(workspace?.items || []).map((item) => (
              <button type="button" key={item.id} className={form.id === item.id ? "active" : ""} onClick={() => void load(search, item.id)}>
                <span><strong>{item.name}</strong><small>{item.internal_code} · {item.category || "Sem categoria"}</small></span>
                <b>{money(Number(item.effective_unit_cost))}</b>
                {item.margin_alert ? <AlertTriangle aria-label="Margem abaixo do mínimo" /> : null}
              </button>
            ))}
          </div>
        </aside>

        <div className="operation-cost-catalog-editor">
          <div className="operation-cost-catalog-result">
            <article><small>Custo efetivo</small><strong>{money(preview.cost)}</strong></article>
            <article><small>Preço de venda</small><strong>{money(form.salePrice)}</strong></article>
            <article><small>Lucro bruto</small><strong>{money(preview.profit)}</strong></article>
            <article className={preview.margin < form.minimumMarginPercent / 100 ? "alert" : ""}><small>Margem</small><strong>{percent(preview.margin)}</strong></article>
            <article><small>Markup</small><strong>{preview.markup.toFixed(2)}×</strong></article>
          </div>

          <form className="operation-cost-catalog-form" onSubmit={save}>
            <div className="operation-cost-catalog-grid">
              <label>Código interno<input value={form.internalCode} onChange={(event) => setForm({ ...form, internalCode: event.target.value.toUpperCase() })} placeholder="EX.: RECH.NINHO" required /></label>
              <label>Nome<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
              <label>Categoria<input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label>
              <label>Tipo<select value={form.itemKind} onChange={(event) => setForm({ ...form, itemKind: event.target.value })}><option value="ingredient">Ingrediente</option><option value="packaging">Embalagem</option><option value="utility">Recurso</option><option value="labor">Mão de obra</option><option value="equipment">Equipamento/acervo</option><option value="service">Serviço</option><option value="other">Outro</option></select></label>
              <label>Origem do custo<select value={form.costOrigin} onChange={(event) => setForm({ ...form, costOrigin: event.target.value as CostOrigin })}><option value="manufactured">Fabricação própria</option><option value="purchased">Produto comprado</option><option value="asset">Item do acervo</option><option value="service">Serviço/recurso</option><option value="manual_provisional">Custo manual provisório</option></select></label>
              <label>Status técnico<select value={form.dataStatus} onChange={(event) => setForm({ ...form, dataStatus: event.target.value as DataStatus })}><option value="provisional">Provisório</option><option value="awaiting_validation">Aguardando validação</option><option value="validated">Validado</option><option value="blocked">Bloqueado</option></select></label>
              <label>Custo manual/provisório<input type="number" min="0" step="0.0001" value={form.manualUnitCost} onChange={(event) => setForm({ ...form, manualUnitCost: Number(event.target.value) })} /></label>
              <label>Preço de venda<input type="number" min="0" step="0.01" value={form.salePrice} onChange={(event) => setForm({ ...form, salePrice: Number(event.target.value) })} /></label>
              <label>Margem mínima (%)<input type="number" min="0" max="99.99" step="0.01" value={form.minimumMarginPercent} onChange={(event) => setForm({ ...form, minimumMarginPercent: Number(event.target.value) })} /></label>
              <label>Status comercial<select value={form.commercialStatus} onChange={(event) => setForm({ ...form, commercialStatus: event.target.value as CommercialStatus })}><option value="draft">Rascunho</option><option value="internal">Somente interno</option><option value="selected_customers">Clientes selecionados</option><option value="public">Público</option><option value="blocked">Bloqueado</option></select></label>
              <label>Fornecedor<input value={form.supplier} onChange={(event) => setForm({ ...form, supplier: event.target.value })} /></label>
              <label>Marca<input value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} /></label>
              <label>Unidade de compra<select value={form.purchaseUnit} onChange={(event) => setForm({ ...form, purchaseUnit: event.target.value })}>{["g","kg","ml","l","unit","package","box","can","tray","hour","kwh","other"].map((unit) => <option value={unit} key={unit}>{unit}</option>)}</select></label>
              <label>Quantidade da embalagem<input type="number" min="0.000001" step="0.000001" value={form.packageQuantity} onChange={(event) => setForm({ ...form, packageQuantity: Number(event.target.value) })} /></label>
              <label>Unidade de consumo<select value={form.consumptionUnit} onChange={(event) => setForm({ ...form, consumptionUnit: event.target.value })}>{["g","kg","ml","l","unit","package","box","can","tray","hour","kwh","other"].map((unit) => <option value={unit} key={unit}>{unit}</option>)}</select></label>
              <label>Perda prevista (%)<input type="number" min="0" max="99.99" step="0.01" value={form.lossPercent} onChange={(event) => setForm({ ...form, lossPercent: Number(event.target.value) })} /></label>
            </div>

            {form.costOrigin === "asset" ? (
              <fieldset className="operation-cost-catalog-asset">
                <legend>Depreciação e custo por utilização</legend>
                <label>Valor de aquisição<input type="number" min="0" step="0.01" value={form.acquisitionCost} onChange={(event) => setForm({ ...form, acquisitionCost: Number(event.target.value) })} /></label>
                <label>Usos esperados<input type="number" min="1" step="1" value={form.expectedUses} onChange={(event) => setForm({ ...form, expectedUses: Number(event.target.value) })} /></label>
                <label>Manutenção por uso<input type="number" min="0" step="0.01" value={form.maintenancePerUse} onChange={(event) => setForm({ ...form, maintenancePerUse: Number(event.target.value) })} /></label>
                <label>Limpeza por uso<input type="number" min="0" step="0.01" value={form.cleaningPerUse} onChange={(event) => setForm({ ...form, cleaningPerUse: Number(event.target.value) })} /></label>
                <label>Reserva de reposição<input type="number" min="0" step="0.01" value={form.replacementReservePerUse} onChange={(event) => setForm({ ...form, replacementReservePerUse: Number(event.target.value) })} /></label>
              </fieldset>
            ) : null}

            <label>Observações<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Origem do custo, condição de compra, validade da estimativa ou observações internas." /></label>
            <label className="operation-cost-catalog-check"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /><span>Item ativo</span></label>
            <button className="operation-cost-catalog-save" type="submit" disabled={busy}><Save /> {busy ? "Salvando…" : "Salvar item e recalcular"}</button>
          </form>

          {form.id && form.costOrigin === "purchased" ? (
            <section className="operation-cost-catalog-price">
              <header><div><small>Histórico de compra</small><h3>Registrar novo preço</h3></div><PackagePlus /></header>
              <div>
                <label>Preço pago<input type="number" min="0" step="0.01" value={priceForm.purchasePrice} onChange={(event) => setPriceForm({ ...priceForm, purchasePrice: Number(event.target.value) })} /></label>
                <label>Quantidade comprada<input type="number" min="0.000001" step="0.000001" value={priceForm.purchasedQuantity} onChange={(event) => setPriceForm({ ...priceForm, purchasedQuantity: Number(event.target.value) })} /></label>
                <label>Unidade<select value={priceForm.purchaseUnit} onChange={(event) => setPriceForm({ ...priceForm, purchaseUnit: event.target.value })}>{["g","kg","ml","l","unit","package","box","can","tray","hour","kwh","other"].map((unit) => <option value={unit} key={unit}>{unit}</option>)}</select></label>
                <label>Quantidade útil<input value={priceForm.usefulQuantity} onChange={(event) => setPriceForm({ ...priceForm, usefulQuantity: event.target.value })} inputMode="decimal" placeholder="Opcional" /></label>
                <label>Status<select value={priceForm.dataStatus} onChange={(event) => setPriceForm({ ...priceForm, dataStatus: event.target.value as DataStatus })}><option value="provisional">Provisório</option><option value="awaiting_validation">Aguardando validação</option><option value="validated">Validado</option><option value="blocked">Bloqueado</option></select></label>
                <label>Origem/nota<input value={priceForm.sourceNote} onChange={(event) => setPriceForm({ ...priceForm, sourceNote: event.target.value })} /></label>
              </div>
              <button type="button" onClick={() => void addPrice()} disabled={busy}><CircleDollarSign /> Registrar preço e recalcular</button>
            </section>
          ) : null}

          <button type="button" className="operation-cost-catalog-refresh" onClick={() => void load(search, form.id || undefined)} disabled={busy}><RefreshCw /> Atualizar cálculo</button>
        </div>
      </div>
    </section>
  );
}
