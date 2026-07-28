import { FormEvent, useEffect, useMemo, useState } from "react";
import { Box, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { bffRpc } from "./services/bff-rpc";
import type {
  ProductCustomizationMode,
  ProductOptionKind,
  ProductType,
} from "./product-configuration";
import "./operation-product-catalog.css";

type WorkspaceProduct = {
  id?: string;
  slug: string;
  segment: string;
  subcategory?: string | null;
  name: string;
  short_description: string;
  description: string;
  base_price: number | null;
  price_suffix: string;
  minimum_quantity: number;
  lead_business_days: number;
  requires_schedule: boolean;
  details: Record<string, unknown>;
  image_url?: string | null;
  original_image_url?: string | null;
  allergens: unknown[];
  show_allergens: boolean;
  published: boolean;
  active: boolean;
  sort_order: number;
  product_type: ProductType;
  customization_mode: ProductCustomizationMode;
  configuration_rules: Record<string, unknown>;
};

type WorkspaceOption = {
  id?: string;
  product_id?: string;
  group_key: string;
  option_code: string;
  option_kind: ProductOptionKind;
  label: string;
  price_adjustment: number;
  unit_cost: number;
  minimum_quantity: number;
  maximum_quantity: number | null;
  active: boolean;
  published: boolean;
  sort_order: number;
};

type Workspace = { products: WorkspaceProduct[]; options: WorkspaceOption[] };

const emptyProduct = (): WorkspaceProduct => ({
  slug: "",
  segment: "sweets",
  subcategory: null,
  name: "",
  short_description: "",
  description: "",
  base_price: null,
  price_suffix: "",
  minimum_quantity: 1,
  lead_business_days: 3,
  requires_schedule: true,
  details: {},
  allergens: [],
  show_allergens: false,
  published: false,
  active: true,
  sort_order: 0,
  product_type: "sweet",
  customization_mode: "option_groups",
  configuration_rules: {
    minimumTotalQuantity: 1,
    maximumTotalQuantity: 10000,
    maximumFlavors: 5,
    minimumQuantityPerFlavor: 1,
    requireExactTotal: false,
    allowAddons: true,
  },
});

const emptyOption = (): WorkspaceOption => ({
  group_key: "sabores",
  option_code: "",
  option_kind: "flavor",
  label: "",
  price_adjustment: 0,
  unit_cost: 0,
  minimum_quantity: 1,
  maximum_quantity: null,
  active: true,
  published: true,
  sort_order: 0,
});

const typeDefaults: Record<ProductType, { segment: string; mode: ProductCustomizationMode }> = {
  cake: { segment: "cakes", mode: "cake_builder" },
  sweet: { segment: "sweets", mode: "option_groups" },
  cookie: { segment: "cookies", mode: "option_groups" },
  school_kit: { segment: "school", mode: "option_groups" },
  fixed: { segment: "events", mode: "none" },
};

export default function OperationProductCatalog() {
  const [workspace, setWorkspace] = useState<Workspace>({ products: [], options: [] });
  const [selectedId, setSelectedId] = useState<string>("");
  const [product, setProduct] = useState<WorkspaceProduct>(emptyProduct());
  const [options, setOptions] = useState<WorkspaceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const load = async () => {
    setLoading(true);
    setNotice("");
    try {
      const data = await bffRpc<Workspace>("manager_get_configurable_product_workspace");
      setWorkspace({ products: data?.products || [], options: data?.options || [] });
      if (selectedId) {
        const next = data?.products?.find((item) => item.id === selectedId);
        if (next) {
          setProduct(next);
          setOptions((data.options || []).filter((item) => item.product_id === selectedId));
        }
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível carregar os produtos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const select = (id: string) => {
    const next = workspace.products.find((item) => item.id === id);
    if (!next) return;
    setSelectedId(id);
    setProduct(next);
    setOptions(workspace.options.filter((item) => item.product_id === id));
    setNotice("");
  };

  const newProduct = () => {
    setSelectedId("");
    setProduct(emptyProduct());
    setOptions([]);
    setNotice("");
  };

  const setProductType = (productType: ProductType) => {
    const defaults = typeDefaults[productType];
    setProduct((current) => ({
      ...current,
      product_type: productType,
      segment: defaults.segment,
      customization_mode: defaults.mode,
      configuration_rules: productType === "sweet"
        ? { ...current.configuration_rules, maximumFlavors: 5, minimumQuantityPerFlavor: 10, requireExactTotal: true }
        : current.configuration_rules,
    }));
  };

  const setRule = (key: string, value: unknown) =>
    setProduct((current) => ({
      ...current,
      configuration_rules: { ...current.configuration_rules, [key]: value },
    }));

  const optionGroups = useMemo(
    () => [...new Set(options.map((option) => option.group_key).filter(Boolean))],
    [options],
  );

  const updateOption = (index: number, patch: Partial<WorkspaceOption>) =>
    setOptions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));

  const removeOption = (index: number) =>
    setOptions((current) => current.flatMap((item, itemIndex) => {
      if (itemIndex !== index) return [item];
      return item.id ? [{ ...item, active: false, published: false }] : [];
    }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    try {
      if (!product.name.trim()) throw new Error("Informe o nome do produto.");
      if (!product.slug.trim()) throw new Error("Informe o identificador do produto.");
      if (product.customization_mode === "option_groups" && !options.some((option) => option.active)) {
        throw new Error("Cadastre pelo menos uma opção ativa para este produto.");
      }
      const result = await bffRpc<{ product_id: string; saved: boolean }>(
        "manager_save_configurable_product",
        { target_product: product, target_options: options },
      );
      setSelectedId(result.product_id);
      setNotice("Produto salvo. As regras de custo e montagem já podem ser usadas no site.");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível salvar o produto.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="operation-product-catalog">
      <header>
        <div><small>Cadastro central</small><h3>Produtos e montadores</h3><p>Tortas, docinhos, biscoitos, kits escolares e produtos fixos no mesmo cadastro.</p></div>
        <Box />
      </header>

      <div className="operation-product-layout">
        <aside>
          <div><button type="button" onClick={newProduct}><Plus /> Novo produto</button><button type="button" onClick={() => void load()} aria-label="Atualizar"><RefreshCw /></button></div>
          {loading ? <p>Carregando…</p> : workspace.products.map((item) => (
            <button type="button" key={item.id} className={selectedId === item.id ? "active" : ""} onClick={() => select(item.id!)}>
              <strong>{item.name}</strong><small>{item.product_type} · {item.customization_mode}</small>
            </button>
          ))}
        </aside>

        <form onSubmit={submit}>
          <fieldset className="operation-product-grid">
            <label>Tipo do produto<select value={product.product_type} onChange={(event) => setProductType(event.target.value as ProductType)}><option value="cake">Torta</option><option value="sweet">Docinho</option><option value="cookie">Biscoito</option><option value="school_kit">Kit Adoce na Escola</option><option value="fixed">Produto fixo</option></select></label>
            <label>Modo de venda<select value={product.customization_mode} onChange={(event) => setProduct({ ...product, customization_mode: event.target.value as ProductCustomizationMode })}><option value="none">Compra direta</option><option value="cake_builder">Montador de tortas</option><option value="option_groups">Grupos de opções</option></select></label>
            <label>Nome<input value={product.name} onChange={(event) => setProduct({ ...product, name: event.target.value })} /></label>
            <label>Identificador<input value={product.slug} onChange={(event) => setProduct({ ...product, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} /></label>
            <label>Segmento<select value={product.segment} onChange={(event) => setProduct({ ...product, segment: event.target.value })}><option value="cakes">Tortas</option><option value="sweets">Docinhos</option><option value="cookies">Biscoitos</option><option value="school">Adoce na Escola</option><option value="events">Eventos</option><option value="rentals">Aluguel</option></select></label>
            <label>Preço-base<input type="number" min="0" step="0.01" value={product.base_price ?? ""} onChange={(event) => setProduct({ ...product, base_price: event.target.value ? Number(event.target.value) : null })} /></label>
            <label>Quantidade mínima<input type="number" min="1" value={product.minimum_quantity} onChange={(event) => setProduct({ ...product, minimum_quantity: Number(event.target.value) })} /></label>
            <label>Antecedência em dias úteis<input type="number" min="0" value={product.lead_business_days} onChange={(event) => setProduct({ ...product, lead_business_days: Number(event.target.value) })} /></label>
            <label className="wide">Descrição curta<input value={product.short_description} onChange={(event) => setProduct({ ...product, short_description: event.target.value })} /></label>
            <label className="wide">Descrição<textarea value={product.description} onChange={(event) => setProduct({ ...product, description: event.target.value })} /></label>
          </fieldset>

          {product.customization_mode === "option_groups" ? <section className="operation-product-rules">
            <header><div><small>Regras do montador</small><h4>Quantidade, sabores e adicionais</h4></div></header>
            <div>
              <label>Máximo de sabores<input type="number" min="1" value={Number(product.configuration_rules.maximumFlavors || 1)} onChange={(event) => setRule("maximumFlavors", Number(event.target.value))} /></label>
              <label>Mínimo por sabor<input type="number" min="1" value={Number(product.configuration_rules.minimumQuantityPerFlavor || 1)} onChange={(event) => setRule("minimumQuantityPerFlavor", Number(event.target.value))} /></label>
              <label>Total mínimo<input type="number" min="1" value={Number(product.configuration_rules.minimumTotalQuantity || product.minimum_quantity)} onChange={(event) => setRule("minimumTotalQuantity", Number(event.target.value))} /></label>
              <label>Total máximo<input type="number" min="1" value={Number(product.configuration_rules.maximumTotalQuantity || 10000)} onChange={(event) => setRule("maximumTotalQuantity", Number(event.target.value))} /></label>
              <label className="check"><input type="checkbox" checked={product.configuration_rules.requireExactTotal === true} onChange={(event) => setRule("requireExactTotal", event.target.checked)} /> Exigir que a soma dos sabores seja igual à quantidade</label>
              <label className="check"><input type="checkbox" checked={product.configuration_rules.allowAddons !== false} onChange={(event) => setRule("allowAddons", event.target.checked)} /> Permitir adicionais</label>
            </div>
          </section> : null}

          {product.customization_mode === "option_groups" ? <section className="operation-product-options-editor">
            <header><div><small>Opções do cliente</small><h4>Sabores, formatos, temas, embalagens e adicionais</h4><p>{optionGroups.length ? `Grupos atuais: ${optionGroups.join(", ")}` : "Crie a primeira opção."}</p></div><button type="button" onClick={() => setOptions([...options, emptyOption()])}><Plus /> Adicionar opção</button></header>
            <div>{options.map((option, index) => <article key={option.id || `new-${index}`} className={!option.active ? "disabled" : ""}>
              <label>Grupo<input value={option.group_key} onChange={(event) => updateOption(index, { group_key: event.target.value.toLowerCase().replace(/\s+/g, "_") })} /></label>
              <label>Tipo<select value={option.option_kind} onChange={(event) => updateOption(index, { option_kind: event.target.value as ProductOptionKind })}><option value="flavor">Sabor</option><option value="variant">Variação</option><option value="format">Formato</option><option value="theme">Tema</option><option value="packaging">Embalagem</option><option value="addon">Adicional</option></select></label>
              <label>Nome<input value={option.label} onChange={(event) => updateOption(index, { label: event.target.value })} /></label>
              <label>Código<input value={option.option_code} onChange={(event) => updateOption(index, { option_code: event.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, "-") })} /></label>
              <label>Custo unitário<input type="number" min="0" step="0.0001" value={option.unit_cost} onChange={(event) => updateOption(index, { unit_cost: Number(event.target.value) })} /></label>
              <label>Acréscimo unitário<input type="number" min="0" step="0.01" value={option.price_adjustment} onChange={(event) => updateOption(index, { price_adjustment: Number(event.target.value) })} /></label>
              <label>Mínimo<input type="number" min="1" value={option.minimum_quantity} onChange={(event) => updateOption(index, { minimum_quantity: Number(event.target.value) })} /></label>
              <label>Máximo<input type="number" min="1" value={option.maximum_quantity ?? ""} onChange={(event) => updateOption(index, { maximum_quantity: event.target.value ? Number(event.target.value) : null })} /></label>
              <button type="button" className="danger" onClick={() => removeOption(index)}><Trash2 /> {option.id ? "Desativar" : "Remover"}</button>
            </article>)}</div>
          </section> : null}

          <footer>
            <label><input type="checkbox" checked={product.active} onChange={(event) => setProduct({ ...product, active: event.target.checked })} /> Ativo</label>
            <label><input type="checkbox" checked={product.published} onChange={(event) => setProduct({ ...product, published: event.target.checked })} /> Publicado</label>
            <button disabled={saving}><Save /> {saving ? "Salvando…" : "Salvar produto"}</button>
          </footer>
          {notice ? <p className="operation-product-notice" role="status">{notice}</p> : null}
        </form>
      </div>
    </section>
  );
}
