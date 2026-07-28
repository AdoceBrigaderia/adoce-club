import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CakeSlice,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import CakeCompositionBuilder from "./CakeCompositionBuilder";
import type { CakeBuilderQuote } from "./cake-builder";
import {
  businessDateAfter,
  formatCommercialDate,
  leadTimeMessage,
  money,
  normalizeBrazilianPhone,
  type CommercialProduct,
} from "./commercial";
import { requireSupabase } from "./lib/supabase";
import { submitPublicServiceRequest } from "./services/public-service-request";
import "./cake-order-experience.css";

const DEMO_PRODUCTS: CommercialProduct[] = [
  {
    id: "00000000-0000-4000-8000-000000000101",
    slug: "torta-15-pessoas",
    segment: "cakes",
    subcategory: null,
    name: "Torta para até 15 pessoas",
    short_description: "Torta artesanal personalizada para comemorações menores.",
    description: "Escolha massas, recheios, cobertura, frutas e adicionais.",
    base_price: 150,
    price_suffix: "a partir de",
    minimum_quantity: 1,
    lead_business_days: 3,
    requires_schedule: true,
    resource_key: null,
    details: { includes: ["3 camadas de bolo", "2 camadas de recheio", "acabamento personalizado"] },
    image_url: "/adoce-hoje/torta-chocolatudo.webp",
    original_image_url: null,
    allergens: [],
    show_allergens: false,
    published: true,
    active: true,
    sort_order: 1,
  },
  {
    id: "00000000-0000-4000-8000-000000000102",
    slug: "torta-25-pessoas",
    segment: "cakes",
    subcategory: null,
    name: "Torta para até 25 pessoas",
    short_description: "Mais rendimento, mantendo a montagem totalmente personalizável.",
    description: "Escolha massas, recheios, cobertura, frutas e adicionais.",
    base_price: 230,
    price_suffix: "a partir de",
    minimum_quantity: 1,
    lead_business_days: 4,
    requires_schedule: true,
    resource_key: null,
    details: { includes: ["3 camadas de bolo", "2 camadas de recheio", "acabamento personalizado"] },
    image_url: "/site/placeholder-torta-sem-foto.svg",
    original_image_url: null,
    allergens: [],
    show_allergens: false,
    published: true,
    active: true,
    sort_order: 2,
  },
];

const today = () => new Date();

export default function CakeOrderExperience() {
  const visualMode = import.meta.env.VITE_ADOCE_VALIDATION_MODE === "visual";
  const [products, setProducts] = useState<CommercialProduct[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [quote, setQuote] = useState<CakeBuilderQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState("");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    date: "",
    time: "15:00",
    notes: "",
    privacy: false,
  });

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await requireSupabase()
          .from("commercial_products")
          .select("*")
          .eq("segment", "cakes")
          .eq("active", true)
          .eq("published", true)
          .order("sort_order");
        if (error) throw error;
        const next = (data || []) as CommercialProduct[];
        if (!active) return;
        const resolved = next.length ? next : visualMode ? DEMO_PRODUCTS : [];
        setProducts(resolved);
        setSelectedId(resolved[0]?.id || "");
        if (!next.length && visualMode)
          setNotice("Produtos demonstrativos carregados para a validação visual.");
      } catch {
        if (!active) return;
        const resolved = visualMode ? DEMO_PRODUCTS : [];
        setProducts(resolved);
        setSelectedId(resolved[0]?.id || "");
        setNotice(
          visualMode
            ? "O catálogo on-line não respondeu; a demonstração local foi carregada."
            : "Não conseguimos abrir as tortas agora. Fale com a Adoce pelo WhatsApp.",
        );
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [visualMode]);

  const selected = useMemo(
    () => products.find((product) => product.id === selectedId) || null,
    [products, selectedId],
  );
  const minimumDate = selected
    ? businessDateAfter(today(), selected.lead_business_days)
    : "";

  useEffect(() => {
    if (!selected) return;
    setQuote(null);
    setSubmitted("");
    setForm((current) => ({
      ...current,
      date: businessDateAfter(today(), selected.lead_business_days),
    }));
  }, [selected]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitted("");
    if (!selected || !quote) {
      setNotice("Conclua a montagem da torta antes de enviar.");
      return;
    }
    if (form.name.trim().length < 2) return setNotice("Informe seu nome.");
    const phone = normalizeBrazilianPhone(form.phone);
    if (phone.length < 12 || phone.length > 13)
      return setNotice("Informe um WhatsApp válido com DDD.");
    if (!form.date || form.date < minimumDate)
      return setNotice(leadTimeMessage(selected.lead_business_days, minimumDate));
    if (!form.privacy)
      return setNotice("Confirme a Política de Privacidade para enviar a solicitação.");

    if (visualMode) {
      setSubmitted("DEMONSTRAÇÃO-VISUAL");
      setNotice("Montagem concluída no modo visual. Nenhum pedido foi gravado.");
      return;
    }

    setSubmitting(true);
    setNotice("");
    try {
      const start = new Date(`${form.date}T${form.time}:00-03:00`);
      const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
      const result = await submitPublicServiceRequest({
        requested_product_id: selected.id,
        requested_customer_name: form.name.trim(),
        requested_customer_phone: phone,
        requested_customer_email: form.email.trim() || null,
        requested_quantity: 1,
        requested_start: start.toISOString(),
        requested_end: end.toISOString(),
        requested_selections: {
          cake_builder: {
            template_id: quote.templateId,
            cake_layers: quote.selection.cakeLayers,
            filling_layers: quote.selection.fillingLayers,
            topping: quote.selection.topping,
            filling_fruits: quote.selection.fillingFruits,
            topping_fruits: quote.selection.toppingFruits,
            filling_extras: quote.selection.fillingExtras,
            topping_extras: quote.selection.toppingExtras,
          },
          preferences: quote.summary.join(" | "),
        },
        requested_notes: form.notes.trim(),
      });
      if (!result.accepted) throw new Error(result.message);
      setSubmitted(result.request_number || "Solicitação registrada");
      setNotice(result.message);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Não foi possível registrar a encomenda agora.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="cake-order-page">
      <header className="cake-order-header">
        <a className="cake-order-brand" href="/#inicio">
          <img src="/site/logo.webp" alt="Adoce Brigaderia" />
          <span><strong>Adoce Brigaderia</strong><small>Tortas por encomenda</small></span>
        </a>
        <a href="/#inicio"><ArrowLeft /> Voltar ao site</a>
      </header>

      <section className="cake-order-hero">
        <div>
          <span>Torta do seu jeito</span>
          <h1>Monte cada camada antes de pedir.</h1>
          <p>Escolha tamanho, massas, recheios, cobertura, frutas e adicionais. A estimativa acompanha suas escolhas e a Adoce confirma tudo antes do sinal.</p>
          <a href="#cake-order-builder">Começar montagem <ArrowRight /></a>
        </div>
        <img src="/adoce-hoje/torta-chocolatudo.webp" alt="Fatia de torta artesanal da Adoce" />
      </section>

      {notice ? <p className="cake-order-notice" role="status">{notice}</p> : null}

      <section className="cake-order-products" aria-labelledby="cake-order-size-title">
        <header><div><small>Etapa 1</small><h2 id="cake-order-size-title">Escolha o tamanho da torta</h2></div><CakeSlice /></header>
        {loading ? <p>Carregando opções…</p> : (
          <div>
            {products.map((product) => (
              <button type="button" key={product.id} className={selectedId === product.id ? "active" : ""} onClick={() => setSelectedId(product.id)}>
                <img src={product.image_url || "/site/placeholder-torta-sem-foto.svg"} alt="" />
                <span><strong>{product.name}</strong><small>{product.short_description}</small><b>{product.base_price === null ? "Valor sob consulta" : `A partir de ${money(product.base_price)}`}</b></span>
                {selectedId === product.id ? <CheckCircle2 /> : <ArrowRight />}
              </button>
            ))}
          </div>
        )}
      </section>

      {selected ? (
        <section id="cake-order-builder" className="cake-order-builder-shell">
          <CakeCompositionBuilder
            productId={selected.id}
            productName={selected.name}
            basePrice={selected.base_price}
            onChange={setQuote}
          />

          <form className="cake-order-form" onSubmit={submit} noValidate>
            <header><div><small>Etapa final</small><h2>Informe data e contato</h2><p>A pré-reserva não é cobrança nem confirmação definitiva.</p></div><CalendarDays /></header>
            <div className="cake-order-form-grid">
              <label>Seu nome<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} autoComplete="name" required /></label>
              <label>WhatsApp com DDD<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} inputMode="tel" autoComplete="tel" required /></label>
              <label>E-mail <small>(opcional)</small><input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} type="email" autoComplete="email" /></label>
              <label>Data desejada<input value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} type="date" min={minimumDate} required /><small><Clock3 /> Primeira data: {formatCommercialDate(minimumDate)}</small></label>
              <label>Horário<input value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} type="time" required /></label>
            </div>
            <label>Observações adicionais<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Tema, cores, escrita, restrições ou outras informações." /></label>
            <label className="cake-order-consent"><input type="checkbox" checked={form.privacy} onChange={(event) => setForm({ ...form, privacy: event.target.checked })} /><span>Li a <a href="/#privacidade">Política de Privacidade</a> e autorizo o contato sobre esta encomenda.</span></label>

            {quote ? <div className="cake-order-total"><span>Estimativa atual</span><strong>{money(quote.estimatedPrice)}</strong><small>Recalculada e confirmada pela Adoce antes do sinal.</small></div> : null}

            {submitted ? (
              <div className="cake-order-success"><CheckCircle2 /><div><small>Montagem concluída</small><strong>{submitted}</strong><p>{notice}</p></div></div>
            ) : (
              <button className="cake-order-submit" disabled={submitting || !quote}>{submitting ? "Enviando…" : visualMode ? "Concluir demonstração" : "Solicitar pré-reserva"}<ArrowRight /></button>
            )}
          </form>
        </section>
      ) : null}

      <section className="cake-order-trust">
        <span><Sparkles /><strong>Feita do zero</strong><small>Montagem registrada por camada</small></span>
        <span><CircleDollarSignIcon /><strong>Custo controlado</strong><small>Itens calculados pelo cadastro interno</small></span>
        <span><ShieldCheck /><strong>Confirmação segura</strong><small>Preço final validado no servidor</small></span>
        <a href="https://wa.me/5585981994370" target="_blank" rel="noreferrer"><MessageCircle /> Falar com a Adoce</a>
      </section>
    </main>
  );
}

function CircleDollarSignIcon() {
  return <CakeSlice aria-hidden="true" />;
}
