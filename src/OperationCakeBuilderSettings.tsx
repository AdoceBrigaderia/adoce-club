import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CakeSlice,
  CircleDollarSign,
  Layers3,
  Plus,
  Save,
  Settings2,
  Trash2,
} from "lucide-react";
import { bffRpc } from "./services/bff-rpc";
import type { CakeBuilderPlacement } from "./cake-builder";
import "./operation-cake-builder-settings.css";

type Product = {
  id: string;
  name: string;
  base_price: number | null;
  active: boolean;
  published: boolean;
};

type Option = {
  id: string;
  placement: CakeBuilderPlacement;
  slug: string;
  label: string;
  description: string;
  price_adjustment: number;
  unit_cost: number;
  active: boolean;
  published: boolean;
  sort_order: number;
};

type Configuration = {
  id: string;
  product_id: string;
  name: string;
  cake_layers: number;
  filling_layers: number;
  allow_mixed_cake_layers: boolean;
  allow_mixed_fillings: boolean;
  active: boolean;
  published: boolean;
  options: Option[];
};

type Workspace = {
  products: Product[];
  selected_product_id: string | null;
  configuration: Configuration | null;
};

const placementLabels: Record<CakeBuilderPlacement, string> = {
  cake_layer: "Sabores das camadas de bolo",
  filling_layer: "Sabores das camadas de recheio",
  topping: "Coberturas",
  filling_fruit: "Frutas permitidas no recheio",
  topping_fruit: "Frutas permitidas na cobertura",
  filling_extra: "Outros produtos no recheio",
  topping_extra: "Outros produtos na cobertura",
};

const placementOrder = Object.keys(placementLabels) as CakeBuilderPlacement[];

const emptyConfiguration = (productId: string): Configuration => ({
  id: "",
  product_id: productId,
  name: "Montagem personalizada",
  cake_layers: 3,
  filling_layers: 2,
  allow_mixed_cake_layers: true,
  allow_mixed_fillings: true,
  active: true,
  published: false,
  options: [],
});

const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const createOption = (placement: CakeBuilderPlacement, sortOrder: number): Option => ({
  id: `new-${crypto.randomUUID()}`,
  placement,
  slug: `opcao-${sortOrder}`,
  label: "",
  description: "",
  price_adjustment: 0,
  unit_cost: 0,
  active: true,
  published: true,
  sort_order: sortOrder,
});

const money = (value: number | null) =>
  value === null
    ? "Valor sob consulta"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(value);

export default function OperationCakeBuilderSettings() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [configuration, setConfiguration] = useState<Configuration | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async (requestedProductId?: string) => {
    setBusy(true);
    setNotice("");
    try {
      const workspace = await bffRpc<Workspace>(
        "staff_get_cake_builder_configuration",
        { target_product_id: requestedProductId || null },
      );
      const selectedId = workspace.selected_product_id || requestedProductId || "";
      setProducts(workspace.products || []);
      setProductId(selectedId);
      setConfiguration(
        workspace.configuration || (selectedId ? emptyConfiguration(selectedId) : null),
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Não foi possível abrir a configuração das tortas.",
      );
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === productId) || null,
    [productId, products],
  );

  const groupedOptions = useMemo(
    () =>
      Object.fromEntries(
        placementOrder.map((placement) => [
          placement,
          (configuration?.options || [])
            .filter((option) => option.placement === placement)
            .sort((left, right) => left.sort_order - right.sort_order),
        ]),
      ) as Record<CakeBuilderPlacement, Option[]>,
    [configuration?.options],
  );

  const estimatedConfiguredCost = useMemo(
    () =>
      (configuration?.options || [])
        .filter((option) => option.active)
        .reduce((sum, option) => sum + Number(option.unit_cost || 0), 0),
    [configuration?.options],
  );

  const updateOption = (id: string, changes: Partial<Option>) => {
    setConfiguration((current) =>
      current
        ? {
            ...current,
            options: current.options.map((option) =>
              option.id === id ? { ...option, ...changes } : option,
            ),
          }
        : current,
    );
  };

  const addOption = (placement: CakeBuilderPlacement) => {
    setConfiguration((current) => {
      if (!current) return current;
      const nextSort =
        Math.max(
          0,
          ...current.options
            .filter((option) => option.placement === placement)
            .map((option) => Number(option.sort_order || 0)),
        ) + 10;
      return {
        ...current,
        options: [...current.options, createOption(placement, nextSort)],
      };
    });
  };

  const removeOption = (id: string) =>
    setConfiguration((current) =>
      current
        ? { ...current, options: current.options.filter((option) => option.id !== id) }
        : current,
    );

  const save = async () => {
    if (!configuration || !productId || busy) return;
    const missingLabel = configuration.options.find((option) => !option.label.trim());
    if (missingLabel) {
      setNotice("Preencha o nome de todas as opções antes de salvar.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const workspace = await bffRpc<Workspace>(
        "manager_save_cake_builder_configuration",
        {
          target_product_id: productId,
          next_name: configuration.name,
          next_cake_layers: configuration.cake_layers,
          next_filling_layers: configuration.filling_layers,
          next_allow_mixed_cake_layers: configuration.allow_mixed_cake_layers,
          next_allow_mixed_fillings: configuration.allow_mixed_fillings,
          next_active: configuration.active,
          next_published: configuration.published,
          next_options: configuration.options.map((option, index) => ({
            ...option,
            id: option.id.startsWith("new-") ? null : option.id,
            slug: slugify(option.slug || option.label) || `opcao-${index + 1}`,
            price_adjustment: Number(option.price_adjustment || 0),
            unit_cost: Number(option.unit_cost || 0),
            sort_order: Number(option.sort_order || (index + 1) * 10),
          })),
        },
      );
      setProducts(workspace.products || products);
      setConfiguration(workspace.configuration || configuration);
      setNotice("Montagem salva. O cliente verá somente as opções publicadas; os custos continuam internos.");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a montagem.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (!configuration && busy)
    return <section className="operation-cake-builder-settings"><p>Carregando montagens de torta…</p></section>;

  return (
    <section className="operation-cake-builder-settings">
      <header className="operation-cake-builder-heading">
        <div>
          <small>Fabricação e custo</small>
          <h2>Montagem das tortas</h2>
          <p>Defina camadas, sabores, frutas, adicionais, custo interno e acréscimo cobrado do cliente.</p>
        </div>
        <Layers3 />
      </header>

      {notice ? <p className="operation-cake-builder-notice" role="status">{notice}</p> : null}

      {!products.length ? (
        <p>Nenhuma torta foi cadastrada no catálogo comercial.</p>
      ) : configuration ? (
        <>
          <div className="operation-cake-builder-controls">
            <label>
              Torta configurada
              <select
                value={productId}
                onChange={(event) => void load(event.target.value)}
                disabled={busy}
              >
                {products.map((product) => (
                  <option value={product.id} key={product.id}>{product.name}</option>
                ))}
              </select>
              <small>Preço base atual: {money(selectedProduct?.base_price ?? null)}</small>
            </label>
            <label>
              Nome interno da montagem
              <input
                value={configuration.name}
                onChange={(event) =>
                  setConfiguration({ ...configuration, name: event.target.value })
                }
              />
            </label>
            <label>
              Camadas de bolo
              <input
                type="number"
                min="1"
                max="8"
                value={configuration.cake_layers}
                onChange={(event) =>
                  setConfiguration({
                    ...configuration,
                    cake_layers: Number(event.target.value),
                  })
                }
              />
            </label>
            <label>
              Camadas de recheio
              <input
                type="number"
                min="0"
                max="7"
                value={configuration.filling_layers}
                onChange={(event) =>
                  setConfiguration({
                    ...configuration,
                    filling_layers: Number(event.target.value),
                  })
                }
              />
            </label>
          </div>

          <div className="operation-cake-builder-flags">
            <label><input type="checkbox" checked={configuration.allow_mixed_cake_layers} onChange={(event) => setConfiguration({ ...configuration, allow_mixed_cake_layers: event.target.checked })} /><span><strong>Permitir massas diferentes</strong><small>O cliente escolhe cada camada de bolo.</small></span></label>
            <label><input type="checkbox" checked={configuration.allow_mixed_fillings} onChange={(event) => setConfiguration({ ...configuration, allow_mixed_fillings: event.target.checked })} /><span><strong>Permitir recheios diferentes</strong><small>O cliente escolhe cada camada de recheio.</small></span></label>
            <label><input type="checkbox" checked={configuration.active} onChange={(event) => setConfiguration({ ...configuration, active: event.target.checked })} /><span><strong>Montagem ativa</strong><small>Disponível para uso interno.</small></span></label>
            <label><input type="checkbox" checked={configuration.published} onChange={(event) => setConfiguration({ ...configuration, published: event.target.checked })} /><span><strong>Publicar para o cliente</strong><small>Libera o montador no site.</small></span></label>
          </div>

          {placementOrder.map((placement) => (
            <section className="operation-cake-builder-group" key={placement}>
              <header>
                <div><small>Opções cadastradas</small><h3>{placementLabels[placement]}</h3></div>
                <button type="button" onClick={() => addOption(placement)}><Plus /> Adicionar</button>
              </header>
              {groupedOptions[placement].length ? (
                <div className="operation-cake-builder-option-list">
                  {groupedOptions[placement].map((option) => (
                    <article key={option.id}>
                      <div className="operation-cake-builder-option-main">
                        <label>Nome<input value={option.label} onChange={(event) => updateOption(option.id, { label: event.target.value, slug: slugify(event.target.value) })} /></label>
                        <label>Identificador<input value={option.slug} onChange={(event) => updateOption(option.id, { slug: slugify(event.target.value) })} /></label>
                        <label>Descrição<input value={option.description || ""} onChange={(event) => updateOption(option.id, { description: event.target.value })} /></label>
                      </div>
                      <div className="operation-cake-builder-option-values">
                        <label><CircleDollarSign /> Custo interno<input type="number" min="0" step="0.01" value={option.unit_cost} onChange={(event) => updateOption(option.id, { unit_cost: Number(event.target.value) })} /></label>
                        <label><CakeSlice /> Acréscimo ao cliente<input type="number" min="0" step="0.01" value={option.price_adjustment} onChange={(event) => updateOption(option.id, { price_adjustment: Number(event.target.value) })} /></label>
                        <label className="operation-cake-builder-inline-check"><input type="checkbox" checked={option.active} onChange={(event) => updateOption(option.id, { active: event.target.checked })} /><span>Ativa</span></label>
                        <label className="operation-cake-builder-inline-check"><input type="checkbox" checked={option.published} onChange={(event) => updateOption(option.id, { published: event.target.checked })} /><span>Publicada</span></label>
                        <button type="button" className="danger" onClick={() => removeOption(option.id)} aria-label={`Excluir ${option.label || "opção"}`}><Trash2 /></button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : <p>Nenhuma opção cadastrada neste grupo.</p>}
            </section>
          ))}

          <footer className="operation-cake-builder-footer">
            <div><Settings2 /><span><small>Soma simples dos custos ativos cadastrados</small><strong>{money(estimatedConfiguredCost)}</strong></span></div>
            <button type="button" onClick={() => void save()} disabled={busy}><Save /> {busy ? "Salvando…" : "Salvar montagem"}</button>
          </footer>
        </>
      ) : null}
    </section>
  );
}
