import { useEffect, useMemo, useState } from "react";
import {
  CakeSlice,
  Check,
  ChevronDown,
  CircleDollarSign,
  Layers3,
  PackagePlus,
  Sparkles,
} from "lucide-react";
import {
  buildCakeBuilderQuote,
  createCakeBuilderSelection,
  fallbackCakeBuilderTemplate,
  normalizeCakeBuilderTemplate,
  normalizeCakeBuilderSelection,
  optionsForPlacement,
  validateCakeBuilderSelection,
  type CakeBuilderOption,
  type CakeBuilderPlacement,
  type CakeBuilderQuote,
  type CakeBuilderSelection,
  type CakeBuilderTemplate,
} from "./cake-builder";
import { requireSupabase } from "./lib/supabase";
import "./cake-composition-builder.css";

type Props = {
  productId: string;
  productName: string;
  basePrice: number | null;
  onChange: (quote: CakeBuilderQuote | null) => void;
};

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

function selectionKey(placement: CakeBuilderPlacement) {
  return {
    filling_fruit: "fillingFruits",
    topping_fruit: "toppingFruits",
    filling_extra: "fillingExtras",
    topping_extra: "toppingExtras",
  }[placement] as
    | "fillingFruits"
    | "toppingFruits"
    | "fillingExtras"
    | "toppingExtras";
}

function OptionChips({
  title,
  description,
  options,
  selected,
  onToggle,
}: {
  title: string;
  description: string;
  options: CakeBuilderOption[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  if (!options.length) return null;
  return (
    <fieldset className="cake-builder-option-fieldset">
      <legend>{title}</legend>
      <p>{description}</p>
      <div className="cake-builder-chips">
        {options.map((option) => {
          const active = selected.includes(option.id);
          return (
            <button
              type="button"
              key={option.id}
              className={active ? "active" : ""}
              aria-pressed={active}
              onClick={() => onToggle(option.id)}
            >
              {active ? <Check /> : <PackagePlus />}
              <span>
                <strong>{option.label}</strong>
                {option.priceAdjustment ? (
                  <small>+ {money(option.priceAdjustment)}</small>
                ) : (
                  <small>sem acréscimo</small>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function CakeCompositionBuilder({
  productId,
  productName,
  basePrice,
  onChange,
}: Props) {
  const visualMode = import.meta.env.VITE_ADOCE_VALIDATION_MODE === "visual";
  const [template, setTemplate] = useState<CakeBuilderTemplate | null>(null);
  const [selection, setSelection] = useState<CakeBuilderSelection | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotice("");

    const load = async () => {
      if (visualMode) {
        const demo = fallbackCakeBuilderTemplate(productId, productName);
        if (!active) return;
        setTemplate(demo);
        setSelection(createCakeBuilderSelection(demo));
        setNotice("Configuração demonstrativa. Na homologação funcional, as opções virão do cadastro da Adoce.");
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await requireSupabase().rpc(
          "public_get_cake_builder_catalog",
          { target_product_id: productId },
        );
        if (error) throw error;
        const candidate = Array.isArray(data) ? data[0] : data;
        const normalized = normalizeCakeBuilderTemplate(candidate);
        if (!active) return;
        setTemplate(normalized);
        setSelection(normalized ? createCakeBuilderSelection(normalized) : null);
        if (!normalized)
          setNotice("A montagem personalizada desta opção ainda será confirmada pela Adoce.");
      } catch {
        if (!active) return;
        setTemplate(null);
        setSelection(null);
        setNotice("Não conseguimos abrir o montador agora. Você ainda pode descrever suas escolhas abaixo.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [productId, productName, visualMode]);

  const quote = useMemo(() => {
    if (!template || !selection) return null;
    return buildCakeBuilderQuote(template, selection, Number(basePrice || 0));
  }, [basePrice, selection, template]);

  const errors = useMemo(
    () => (template && selection ? validateCakeBuilderSelection(template, selection) : []),
    [selection, template],
  );

  useEffect(() => {
    onChange(quote && errors.length === 0 ? quote : null);
  }, [errors.length, onChange, quote]);

  if (loading) {
    return (
      <section className="cake-builder loading" aria-busy="true">
        <CakeSlice />
        <div><strong>Preparando o montador da sua torta…</strong><small>Carregando camadas, sabores e adicionais.</small></div>
      </section>
    );
  }

  if (!template || !selection || !quote) {
    return notice ? <p className="cake-builder-notice">{notice}</p> : null;
  }

  const updateLayer = (
    field: "cakeLayers" | "fillingLayers",
    index: number,
    value: string,
  ) => {
    setSelection((current) => {
      if (!current) return current;
      const next = [...current[field]];
      next[index] = value;
      return normalizeCakeBuilderSelection(template, { ...current, [field]: next });
    });
  };

  const toggleOption = (
    placement: "filling_fruit" | "topping_fruit" | "filling_extra" | "topping_extra",
    id: string,
  ) => {
    const key = selectionKey(placement);
    setSelection((current) => {
      if (!current) return current;
      const selected = current[key];
      const next = selected.includes(id)
        ? selected.filter((item) => item !== id)
        : [...selected, id];
      return normalizeCakeBuilderSelection(template, { ...current, [key]: next });
    });
  };

  const cakeOptions = optionsForPlacement(template, "cake_layer");
  const fillingOptions = optionsForPlacement(template, "filling_layer");
  const toppingOptions = optionsForPlacement(template, "topping");

  return (
    <section className="cake-builder" aria-labelledby="cake-builder-title">
      <header className="cake-builder-heading">
        <div>
          <small>Monte sua torta</small>
          <h3 id="cake-builder-title">Escolha cada camada, recheio e cobertura</h3>
          <p>A estrutura cadastrada pela Adoce orienta as escolhas e calcula uma estimativa sem substituir a confirmação final.</p>
        </div>
        <Layers3 />
      </header>

      {notice ? <p className="cake-builder-notice" role="status">{notice}</p> : null}

      <div className="cake-builder-structure">
        <span><strong>{template.cakeLayers}</strong><small>camadas de bolo</small></span>
        <span><strong>{template.fillingLayers}</strong><small>camadas de recheio</small></span>
        <span><strong>1</strong><small>cobertura</small></span>
      </div>

      <section className="cake-builder-layer-group">
        <header><CakeSlice /><div><small>Etapa 1</small><h4>Sabores das camadas de bolo</h4></div></header>
        <div className="cake-builder-layer-list">
          {selection.cakeLayers.map((selectedId, index) => (
            <label key={`cake-${index}`}>
              <span>Camada de bolo {index + 1}</span>
              <div><select value={selectedId} onChange={(event) => updateLayer("cakeLayers", index, event.target.value)}>
                {cakeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}{option.priceAdjustment ? ` (+${money(option.priceAdjustment)})` : ""}</option>)}
              </select><ChevronDown /></div>
            </label>
          ))}
        </div>
      </section>

      <section className="cake-builder-layer-group">
        <header><Sparkles /><div><small>Etapa 2</small><h4>Sabores das camadas de recheio</h4></div></header>
        <div className="cake-builder-layer-list">
          {selection.fillingLayers.map((selectedId, index) => (
            <label key={`filling-${index}`}>
              <span>Camada de recheio {index + 1}</span>
              <div><select value={selectedId} onChange={(event) => updateLayer("fillingLayers", index, event.target.value)}>
                {fillingOptions.map((option) => <option key={option.id} value={option.id}>{option.label}{option.priceAdjustment ? ` (+${money(option.priceAdjustment)})` : ""}</option>)}
              </select><ChevronDown /></div>
            </label>
          ))}
        </div>
      </section>

      <section className="cake-builder-layer-group">
        <header><Sparkles /><div><small>Etapa 3</small><h4>Cobertura</h4></div></header>
        <div className="cake-builder-topping-options">
          {toppingOptions.map((option) => (
            <button type="button" key={option.id} className={selection.topping === option.id ? "active" : ""} aria-pressed={selection.topping === option.id} onClick={() => setSelection((current) => current ? normalizeCakeBuilderSelection(template, { ...current, topping: option.id }) : current)}>
              {selection.topping === option.id ? <Check /> : <CakeSlice />}
              <span><strong>{option.label}</strong><small>{option.priceAdjustment ? `+ ${money(option.priceAdjustment)}` : "sem acréscimo"}</small></span>
            </button>
          ))}
        </div>
      </section>

      <OptionChips
        title="Frutas no recheio"
        description="Inclua somente as frutas permitidas para esta montagem."
        options={optionsForPlacement(template, "filling_fruit")}
        selected={selection.fillingFruits}
        onToggle={(id) => toggleOption("filling_fruit", id)}
      />
      <OptionChips
        title="Frutas na cobertura"
        description="Escolha frutas para finalizar a torta."
        options={optionsForPlacement(template, "topping_fruit")}
        selected={selection.toppingFruits}
        onToggle={(id) => toggleOption("topping_fruit", id)}
      />
      <OptionChips
        title="Adicionais no recheio"
        description="Chocolate, crocante e outros produtos cadastrados pela Adoce."
        options={optionsForPlacement(template, "filling_extra")}
        selected={selection.fillingExtras}
        onToggle={(id) => toggleOption("filling_extra", id)}
      />
      <OptionChips
        title="Adicionais na cobertura"
        description="Acabamentos opcionais cadastrados para esta torta."
        options={optionsForPlacement(template, "topping_extra")}
        selected={selection.toppingExtras}
        onToggle={(id) => toggleOption("topping_extra", id)}
      />

      <section className="cake-builder-summary">
        <header><div><small>Resumo da montagem</small><h4>Sua torta até aqui</h4></div><CircleDollarSign /></header>
        <ul>{quote.summary.map((line) => <li key={line}><Check /> {line}</li>)}</ul>
        <div><span>Estimativa a partir de</span><strong>{money(quote.estimatedPrice)}</strong></div>
        <p>O valor final será recalculado pelo servidor usando o cadastro oficial e confirmado antes do sinal.</p>
      </section>

      {errors.length ? <div className="cake-builder-errors" role="alert">{errors.map((error) => <p key={error}>{error}</p>)}</div> : null}
    </section>
  );
}
