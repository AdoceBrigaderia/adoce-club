import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, PackageCheck, ShieldCheck } from "lucide-react";
import ConfigurableProductBuilder from "./ConfigurableProductBuilder";
import {
  normalizeProductConfigurationRules,
  productConfigurationPayload,
  quoteProductConfiguration,
  type ConfigurableCommercialProduct,
  type ProductConfigurationDraft,
  type ProductConfigurationQuote,
} from "./product-configuration";
import { businessDateAfter, formatCommercialDate, money, normalizeBrazilianPhone } from "./commercial";
import { requireSupabase } from "./lib/supabase";
import { submitPublicServiceRequest } from "./services/public-service-request";
import "./configurable-product-catalog.css";

const copy = {
  sweets: {
    eyebrow: "Docinhos feitos um a um",
    title: "Escolha os sabores e grave cada detalhe do pedido.",
    description: "Distribua a quantidade entre os sabores disponíveis. O pedido chega à Adoce com sabores, quantidades e adicionais separados.",
  },
  cookies: {
    eyebrow: "Biscoitos por encomenda",
    title: "Escolha formato, sabor, tema e embalagem.",
    description: "Cada opção fica registrada no pedido para evitar perda de informação durante a produção.",
  },
  school: {
    eyebrow: "Adoce na Escola",
    title: "Escolha o kit e acrescente somente o que fizer sentido.",
    description: "Os itens incluídos e os adicionais ficam registrados junto com a quantidade e a data da comemoração.",
  },
} as const;

type Segment = keyof typeof copy;

export default function ConfigurableProductCatalogPage({ segment }: { segment: Segment }) {
  const [products, setProducts] = useState<ConfigurableCommercialProduct[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [draft, setDraft] = useState<ProductConfigurationDraft>({});
  const [quote, setQuote] = useState<ProductConfigurationQuote | null>(null);
  const [configurationError, setConfigurationError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requestNumber, setRequestNumber] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", email: "", date: "", time: "15:00", notes: "", privacy: false });
  const text = copy[segment];

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      const { data, error } = await requireSupabase().rpc("get_configurable_product_catalog", { target_segment: segment });
      if (!active) return;
      if (error) {
        setNotice("Não conseguimos carregar as opções agora. Fale com a Adoce pelo WhatsApp.");
        setProducts([]);
      } else {
        const next = (Array.isArray(data) ? data : []) as ConfigurableCommercialProduct[];
        setProducts(next);
        setSelectedId(next[0]?.id || "");
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [segment]);

  const selected = useMemo(() => products.find((product) => product.id === selectedId) || null, [products, selectedId]);
  const rules = useMemo(
    () => normalizeProductConfigurationRules(selected?.configuration_rules),
    [selected],
  );
  const priceTiers = rules.priceTiers;
  const minimumDate = selected ? businessDateAfter(new Date(), selected.lead_business_days) : "";

  useEffect(() => {
    if (!selected) return;
    const initialQuantity = priceTiers[0]?.quantity || selected.minimum_quantity;
    setQuantity(initialQuantity);
    setDraft({});
    setQuote(null);
    setConfigurationError("");
    setRequestNumber("");
    setForm((current) => ({ ...current, date: businessDateAfter(new Date(), selected.lead_business_days) }));
  }, [selected, priceTiers]);

  const updateQuantity = (next: number) => {
    if (!selected) return;
    const normalized = Math.max(selected.minimum_quantity, Math.floor(next || selected.minimum_quantity));
    setQuantity(normalized);
    try {
      setQuote(quoteProductConfiguration(selected, normalized, draft));
      setConfigurationError("");
    } catch (error) {
      setQuote(null);
      setConfigurationError(error instanceof Error ? error.message : "Revise a configuração.");
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setNotice("");
    if (!selected) return;
    let finalQuote = quote;
    try {
      finalQuote = quoteProductConfiguration(selected, quantity, draft);
      setQuote(finalQuote);
      setConfigurationError("");
    } catch (error) {
      setConfigurationError(error instanceof Error ? error.message : "Revise a configuração.");
      return;
    }
    if (selected.customization_mode === "option_groups" && !finalQuote) return;
    if (form.name.trim().length < 2) return setNotice("Informe seu nome.");
    const phone = normalizeBrazilianPhone(form.phone);
    if (phone.length < 12 || phone.length > 13) return setNotice("Informe um WhatsApp válido com DDD.");
    if (!form.date || form.date < minimumDate) return setNotice(`A primeira data disponível é ${formatCommercialDate(minimumDate)}.`);
    if (!form.privacy) return setNotice("Confirme os Termos e a Política de Privacidade.");

    setSubmitting(true);
    try {
      const start = new Date(`${form.date}T${form.time}:00-03:00`);
      const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
      const result = await submitPublicServiceRequest({
        requested_product_id: selected.id,
        requested_customer_name: form.name.trim(),
        requested_customer_phone: phone,
        requested_customer_email: form.email.trim() || null,
        requested_quantity: quantity,
        requested_start: start.toISOString(),
        requested_end: end.toISOString(),
        requested_selections: finalQuote ? { product_configuration: productConfigurationPayload(finalQuote) } : {},
        requested_notes: form.notes.trim(),
      });
      if (!result.accepted) throw new Error(result.message);
      setRequestNumber(result.request_number || "Solicitação registrada");
      setNotice(result.message);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível registrar a encomenda.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="configurable-catalog-page">
      <header className="configurable-catalog-header">
        <a href="/#inicio"><img src="/site/logo.webp" alt="Adoce Brigaderia" /><span><strong>Adoce Brigaderia</strong><small>{text.eyebrow}</small></span></a>
        <a href="/#inicio"><ArrowLeft /> Voltar ao site</a>
      </header>

      <section className="configurable-catalog-hero">
        <div><small>{text.eyebrow}</small><h1>{text.title}</h1><p>{text.description}</p><a href="#configurable-products">Escolher produto <ArrowRight /></a></div>
        <img src={segment === "sweets" ? "/adoce-hoje/docinhos-tradicionais.webp" : "/site/placeholder-produto-sem-foto.svg"} alt="Produto artesanal da Adoce" />
      </section>

      {notice ? <p className="configurable-catalog-notice" role="status">{notice}</p> : null}

      <section id="configurable-products" className="configurable-product-selector">
        <header><small>Etapa 1</small><h2>Escolha o produto</h2></header>
        {loading ? <p>Carregando opções…</p> : products.length ? <div>{products.map((product) => (
          <button type="button" key={product.id} className={selectedId === product.id ? "active" : ""} onClick={() => setSelectedId(product.id)}>
            <img src={product.image_url || "/site/placeholder-produto-sem-foto.svg"} alt="" />
            <span><strong>{product.name}</strong><small>{product.short_description}</small><b>{money(product.base_price)}</b></span>
            {selectedId === product.id ? <CheckCircle2 /> : <ArrowRight />}
          </button>
        ))}</div> : <p>Nenhum produto publicado nesta categoria.</p>}
      </section>

      {selected ? <form className="configurable-order-form" onSubmit={submit} noValidate>
        <section className="configurable-order-quantity">
          <div>
            <small>Etapa 2</small>
            <h2>{priceTiers.length ? "Escolha o pacote" : "Defina a quantidade"}</h2>
            <p>{priceTiers.length ? "Os valores e o limite de sabores mudam conforme o pacote." : `Mínimo: ${selected.minimum_quantity} unidade(s).`}</p>
          </div>
          {priceTiers.length ? (
            <select value={quantity} onChange={(event) => updateQuantity(Number(event.target.value))} aria-label="Pacote da encomenda">
              {priceTiers.map((tier) => <option value={tier.quantity} key={tier.quantity}>{tier.quantity} unidades — {money(tier.price)}</option>)}
            </select>
          ) : (
            <input type="number" min={selected.minimum_quantity} max={rules.maximumTotalQuantity} value={quantity} onChange={(event) => updateQuantity(Number(event.target.value))} />
          )}
        </section>

        <ConfigurableProductBuilder product={selected} quantity={quantity} draft={draft} onDraftChange={setDraft} onQuoteChange={(next, error) => { setQuote(next); setConfigurationError(error); }} />
        {configurationError ? <p className="configurable-catalog-error" role="alert">{configurationError}</p> : null}
        {quote ? <aside className="configurable-quote"><strong>Resumo registrado</strong><p>{quote.summary.join(" · ") || "Produto sem personalização"}</p><small>Total estimado: {money(quote.estimatedPrice)}{quote.priceAdjustment > 0 ? ` · adicionais: ${money(quote.priceAdjustment)}` : ""}</small></aside> : null}

        <section className="configurable-customer-data">
          <header><small>Etapa 3</small><h2>Seus dados e a data</h2></header>
          <div>
            <label>Nome<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} autoComplete="name" /></label>
            <label>WhatsApp<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} inputMode="tel" autoComplete="tel" /></label>
            <label>E-mail <small>(opcional)</small><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
            <label>Data<input type="date" min={minimumDate} value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
            <label>Horário<input type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} /></label>
          </div>
          <label>Observações<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
          <label className="configurable-consent"><input type="checkbox" checked={form.privacy} onChange={(event) => setForm({ ...form, privacy: event.target.checked })} /><span>Li e aceito os <a href="/#termos">Termos</a> e a <a href="/#privacidade">Política de Privacidade</a>.</span></label>
          <p><ShieldCheck /> As escolhas são recalculadas e validadas no servidor antes de gravar.</p>
          <button disabled={submitting || Boolean(configurationError)}>{submitting ? "Registrando…" : "Solicitar pré-reserva"} <ArrowRight /></button>
        </section>
      </form> : null}

      {requestNumber ? <section className="configurable-success"><PackageCheck /><small>Pré-reserva registrada</small><h2>{requestNumber}</h2><p>Os sabores, quantidades e adicionais foram vinculados ao pedido.</p></section> : null}
    </main>
  );
}
