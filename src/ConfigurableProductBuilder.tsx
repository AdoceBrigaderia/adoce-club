import { Minus, Plus, ShoppingBasket } from "lucide-react";
import { useMemo } from "react";
import {
  quoteProductConfiguration,
  type ConfigurableCommercialProduct,
  type ProductConfigurationDraft,
  type ProductConfigurationQuote,
} from "./product-configuration";
import "./configurable-product-builder.css";

const groupLabel = (group: string) =>
  ({
    sabores: "Escolha os sabores",
    adicionais: "Adicionais",
    formatos: "Formatos",
    temas: "Temas",
    embalagens: "Embalagens",
    variacoes: "Variações do kit",
  })[group] || group.replace(/_/g, " ");

export default function ConfigurableProductBuilder({
  product,
  quantity,
  draft,
  onDraftChange,
  onQuoteChange,
}: {
  product: ConfigurableCommercialProduct;
  quantity: number;
  draft: ProductConfigurationDraft;
  onDraftChange: (draft: ProductConfigurationDraft) => void;
  onQuoteChange: (quote: ProductConfigurationQuote | null, error: string) => void;
}) {
  const grouped = useMemo(
    () =>
      product.options
        .filter((option) => option.active && option.published)
        .reduce<Record<string, typeof product.options>>((acc, option) => {
          (acc[option.group_key] ||= []).push(option);
          return acc;
        }, {}),
    [product.options],
  );

  const update = (optionId: string, next: number) => {
    const candidate = { ...draft, [optionId]: Math.max(0, next) };
    onDraftChange(candidate);
    try {
      const quote = quoteProductConfiguration(product, quantity, candidate);
      onQuoteChange(quote, "");
    } catch (error) {
      onQuoteChange(null, error instanceof Error ? error.message : "Revise a configuração.");
    }
  };

  if (product.customization_mode !== "option_groups") return null;

  return (
    <section className="configurable-product-builder" aria-label={`Montagem de ${product.name}`}>
      <header>
        <div>
          <small>Monte seu pedido</small>
          <h3>{product.name}</h3>
          <p>As escolhas abaixo ficam gravadas individualmente no pedido.</p>
        </div>
        <ShoppingBasket />
      </header>

      {Object.entries(grouped).map(([group, options]) => (
        <fieldset key={group}>
          <legend>{groupLabel(group)}</legend>
          <div className="configurable-product-options">
            {options.map((option) => {
              const value = Number(draft[option.id] || 0);
              const isToggle = option.option_kind !== "flavor" && option.maximum_quantity === 1;
              const step = option.option_kind === "flavor"
                ? Math.max(1, option.minimum_quantity)
                : 1;
              return (
                <article key={option.id} className={value > 0 ? "selected" : ""}>
                  <div>
                    <strong>{option.label}</strong>
                    <small>
                      {option.price_adjustment > 0
                        ? `Acréscimo de R$ ${option.price_adjustment.toFixed(2).replace(".", ",")}`
                        : "Sem acréscimo"}
                    </small>
                    {!isToggle && step > 1 ? <small>Adicionar de {step} em {step}</small> : null}
                  </div>
                  {isToggle ? (
                    <button type="button" aria-pressed={value > 0} onClick={() => update(option.id, value > 0 ? 0 : 1)}>
                      {value > 0 ? "Remover" : "Adicionar"}
                    </button>
                  ) : (
                    <div className="configurable-product-counter">
                      <button type="button" aria-label={`Diminuir ${option.label} em ${step}`} onClick={() => update(option.id, value - step)}>
                        <Minus />
                      </button>
                      <output aria-label={`Quantidade de ${option.label}`}>{value}</output>
                      <button type="button" aria-label={`Aumentar ${option.label} em ${step}`} onClick={() => update(option.id, value + step)}>
                        <Plus />
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </fieldset>
      ))}
    </section>
  );
}
