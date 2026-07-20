import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CakeSlice,
  Check,
  Clock3,
  Heart,
  MapPin,
  MessageCircle,
  PackageCheck,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import {
  businessDateAfter,
  commercialWhatsAppMessage,
  CommercialProduct,
  CommercialProductOption,
  CommercialSegment,
  money,
  normalizeBrazilianPhone,
  segmentLabels,
  ServiceRequestResult,
} from "./commercial";
import "./commercial-catalog.css";
import "./commercial-product-options.css";
import "./commercial-editorial.css";

const segments = Object.keys(segmentLabels) as CommercialSegment[];
type SegmentMedia = {
  segment: CommercialSegment;
  image_url: string;
  alt_text: string;
};

const segmentFallbackMedia: Record<CommercialSegment, SegmentMedia> = {
  cakes: { segment: "cakes", image_url: "/site/hero-cake.webp", alt_text: "Fatia artesanal de chocolate da Adoce" },
  sweets: { segment: "sweets", image_url: "/adoce-hoje/docinhos-tradicionais.webp", alt_text: "Docinhos artesanais tradicionais da Adoce" },
  events: { segment: "events", image_url: "/adoce-hoje/tabuleiro-doces.webp", alt_text: "Atendimento real com o Tabuleiro de Doces da Adoce" },
  school: { segment: "school", image_url: "/adoce-hoje/adoce-na-escola.webp", alt_text: "Comemoração real organizada pela Adoce em uma escola" },
  rentals: { segment: "rentals", image_url: "/adoce-hoje/festas-eventos.webp", alt_text: "Decoração real montada com peças disponíveis para locação" },
};

const singleImageSegments = new Set<CommercialSegment>(["events", "school", "rentals"]);
const groupOptions = (options: CommercialProductOption[]) => options.reduce<Record<string, CommercialProductOption[]>>(
  (groups, option) => ({ ...groups, [option.group_key]: [...(groups[option.group_key] || []), option] }),
  {},
);
const catalogProductImage = (product: CommercialProduct) => {
  if (product.image_url && !product.image_url.includes("instagram.com/")) return product.image_url;
  if (product.slug === "docinhos-tradicionais") return "/adoce-hoje/docinhos-tradicionais.webp";
  if (product.slug === "docinhos-especiais") return "/adoce-hoje/docinhos-premium.webp";
  return null;
};

function Brand({ subtitle = "Encomendas & eventos" }: { subtitle?: string }) {
  return (
    <a className="commercial-brand" href="/#inicio">
      <img src="/site/logo.webp" alt="Adoce Brigaderia" />
      <span>
        <strong>Adoce Brigaderia</strong>
        <small>{subtitle}</small>
      </span>
    </a>
  );
}

function ProductDetails({ product }: { product: CommercialProduct }) {
  return (
    <div className="commercial-product-details">
      {product.details.packages?.length ? (
        <div className="commercial-package-prices">
          {product.details.packages.map((item) => (
            <span key={item.quantity}>
              <strong>{item.quantity} unidades</strong>
              <b>{money(item.price)}</b>
              {item.flavors ? <small>até {item.flavors} sabor(es)</small> : null}
            </span>
          ))}
        </div>
      ) : null}
      {product.details.additional_price ? (
        <p className="commercial-additional-price">
          Criança adicional: <strong>{money(product.details.additional_price)}</strong>
        </p>
      ) : null}
      {product.details.includes?.length ? (
        <ul>
          {product.details.includes.map((item) => (
            <li key={item}>
              <Check /> {item}
            </li>
          ))}
        </ul>
      ) : null}
      {product.details.rules?.length ? (
        <div className="commercial-rules">
          {product.details.rules.map((rule) => (
            <small key={rule}>{rule}</small>
          ))}
        </div>
      ) : null}
      {product.options?.length ? (
        <div className="commercial-option-groups">
          {Object.entries(groupOptions(product.options)).map(([group, options]) => (
            <div key={group}>
              <strong>{group.replace(/_/g, " ")}</strong>
              <p>{options.map((option) => `${option.label}${option.price_adjustment ? ` (+${money(option.price_adjustment)})` : ""}`).join(" · ")}</p>
            </div>
          ))}
        </div>
      ) : null}
      {product.show_allergens && product.allergens.length ? (
        <p className="commercial-allergens">
          Alergênicos informados: {product.allergens.join(", ")}.
        </p>
      ) : null}
    </div>
  );
}

const experienceCopy: Record<CommercialSegment, { label: string; title: string; text: string }> = {
  cakes: {
    label: "Pedidos por encomenda",
    title: "Tortas e docinhos feitos para o seu momento.",
    text: "Escolha tamanhos, recheios, docinhos e adicionais. Informe a data e receba a confirmação da equipe.",
  },
  sweets: {
    label: "Docinhos por encomenda",
    title: "Pequenas doçuras para completar a celebração.",
    text: "Pacotes tradicionais e especiais com quantidades, sabores e valores administrados pela Adoce.",
  },
  events: {
    label: "Festas e eventos",
    title: "Experiências Adoce para momentos que ficam.",
    text: "Tabuleiro de Doces e experiências para servir, encantar e celebrar com organização.",
  },
  school: {
    label: "Adoce na Escola",
    title: "Uma comemoração gostosa, bonita e organizada na escola.",
    text: "Pacotes completos para celebrar com as crianças, com antecedência mínima de cinco dias úteis.",
  },
  rentals: {
    label: "Aluguel de decoração",
    title: "Uma comemoração bonita, com peças escolhidas para o seu momento.",
    text: "Painéis, cilindros, boleiras e kits para retirar, montar do seu jeito e devolver com segurança.",
  },
};

const catalogIntroCopy: Record<CommercialSegment, string> = {
  cakes: "Escolha o tamanho e descubra tudo o que pode deixar sua torta com a cara da celebração.",
  sweets: "Veja os docinhos por inteiro, compare os pacotes e escolha os sabores que vão completar a mesa.",
  events: "A experiência é a mesma; escolha a quantidade que combina com o número de convidados.",
  school: "A foto mostra uma comemoração real. Compare os pacotes e escolha o nível de experiência para a turma.",
  rentals: "A foto mostra uma montagem real. Compare os kits e veja quais peças fazem sentido para a sua festa.",
};

export default function CommercialCatalog({ initialSegment = "cakes" }: { initialSegment?: CommercialSegment }) {
  const [products, setProducts] = useState<CommercialProduct[]>([]);
  const [segmentMedia, setSegmentMedia] = useState<SegmentMedia[]>([]);
  const [segment, setSegment] = useState<CommercialSegment>(initialSegment);
  const [selected, setSelected] = useState<CommercialProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState<ServiceRequestResult | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    quantity: 1,
    date: "",
    time: "10:00",
    location: "",
    preferences: "",
    notes: "",
    privacy: false,
  });

  useEffect(() => {
    void (async () => {
      const [productResult, optionResult, mediaResult] = await Promise.all([
        requireSupabase().from("commercial_products").select("*").eq("active", true).eq("published", true).order("sort_order"),
        requireSupabase().from("commercial_product_options").select("*").eq("active", true).order("sort_order"),
        requireSupabase().from("commercial_segment_media").select("segment,image_url,alt_text"),
      ]);
      if (productResult.error || optionResult.error) setNotice("Não foi possível carregar o cardápio agora.");
      else {
        const options = (optionResult.data || []) as CommercialProductOption[];
        setProducts(((productResult.data || []) as CommercialProduct[]).map((product) => ({
          ...product,
          segment: product.slug === "festa-na-mesa" ? "school" : product.segment,
          options: options.filter((option) => option.product_id === product.id),
        })));
        if (!mediaResult.error) setSegmentMedia((mediaResult.data || []) as SegmentMedia[]);
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => setSegment(initialSegment), [initialSegment]);

  const visibleProducts = useMemo(
    () => products.filter((product) => product.segment === segment),
    [products, segment],
  );
  const activeMedia = segmentMedia.find((item) => item.segment === segment) || segmentFallbackMedia[segment];

  const openRequest = (product: CommercialProduct) => {
    setSelected(product);
    setResult(null);
    setNotice("");
    setForm((current) => ({
      ...current,
      quantity: product.minimum_quantity,
      date: businessDateAfter(new Date(), product.lead_business_days),
      preferences: "",
      notes: "",
    }));
    requestAnimationFrame(() =>
      document.getElementById("solicitar-encomenda")?.scrollIntoView({ behavior: "smooth" }),
    );
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !form.privacy) {
      setNotice("Confirme a leitura da política de privacidade para continuar.");
      return;
    }
    const phone = normalizeBrazilianPhone(form.phone);
    if (phone.length < 12 || phone.length > 13) {
      setNotice("Informe um WhatsApp válido com DDD.");
      return;
    }
    const start = new Date(`${form.date}T${form.time}:00-03:00`);
    const durationHours = selected.segment === "rentals" ? 48 : 2;
    const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);
    setSubmitting(true);
    setNotice("");
    const { data, error } = await requireSupabase().rpc("submit_service_request", {
      requested_product_id: selected.id,
      requested_customer_name: form.name.trim(),
      requested_customer_phone: phone,
      requested_customer_email: form.email.trim() || null,
      requested_quantity: form.quantity,
      requested_start: start.toISOString(),
      requested_end: end.toISOString(),
      requested_location: form.location.trim(),
      requested_selections: { preferences: form.preferences.trim() },
      requested_notes: form.notes.trim(),
    });
    setSubmitting(false);
    if (error) {
      setNotice(error.message);
      return;
    }
    const nextResult = data as ServiceRequestResult;
    setResult(nextResult);
    if (!nextResult.accepted) setNotice(nextResult.message);
  };

  const whatsappUrl = selected
    ? `https://wa.me/5585981994370?text=${encodeURIComponent(
        commercialWhatsAppMessage(selected, result?.request_number),
      )}`
    : "";

  return (
    <main className="commercial-page">
      <header className="commercial-header">
        <Brand subtitle={experienceCopy[segment].label} />
        <a href="/#inicio">
          <ArrowLeft /> Voltar ao site
        </a>
      </header>

      <section className={`commercial-hero segment-${segment}`}>
        <div>
          <span>{experienceCopy[segment].label}</span>
          <h1>{experienceCopy[segment].title}</h1>
          <p>{experienceCopy[segment].text}</p>
        </div>
        <div className="commercial-hero-note">
          <CalendarDays />
          <strong>Agenda conectada à operação</strong>
          <p>A solicitação entra como pré-reserva por 48 horas. A data é confirmada com o sinal.</p>
        </div>
      </section>

      <div className="commercial-proof-strip" aria-label="Diferenciais da Adoce">
        <span><Sparkles /> Produção artesanal</span>
        <span><Heart /> Cuidado em cada detalhe</span>
        <span><MessageCircle /> Atendimento próximo pelo WhatsApp</span>
      </div>

      <nav className="commercial-segments" aria-label="Categorias de encomendas">
        {segments.map((item) => (
          <button
            key={item}
            className={segment === item ? "active" : ""}
            onClick={() => setSegment(item)}
          >
            {segmentLabels[item]}
          </button>
        ))}
      </nav>

      <section className="commercial-catalog" aria-live="polite">
        <div className="commercial-section-title">
          <span>{segmentLabels[segment]}</span>
          <h2>{segment === "cakes" ? "Tortas inteiras" : segmentLabels[segment]}</h2>
          <p>
            {catalogIntroCopy[segment]}
          </p>
        </div>
        {singleImageSegments.has(segment) ? (
          <figure className={`commercial-segment-showcase showcase-${segment}`}>
            <img src={activeMedia.image_url} alt={activeMedia.alt_text} />
            <figcaption>
              <strong>Experiência real Adoce</strong>
              <span>A apresentação pode variar conforme tema, local, escolhas e disponibilidade.</span>
            </figcaption>
          </figure>
        ) : null}
        {loading ? (
          <p>Carregando opções...</p>
        ) : visibleProducts.length ? (
          <div className="commercial-product-list">
            {visibleProducts.map((product) => {
              const productImage = singleImageSegments.has(product.segment) ? null : catalogProductImage(product);
              return (
              <article className={productImage ? "with-image" : ""} key={product.id}>
                {productImage ? <img className="commercial-product-image" src={productImage} alt={product.name} /> : null}
                <div className="commercial-product-main">
                  <span>{segmentLabels[product.segment]}</span>
                  <h3>{product.name}</h3>
                  <p>{product.short_description}</p>
                  {product.description && product.description !== product.short_description ? <small className="commercial-product-description">{product.description}</small> : null}
                  <strong>
                    {product.price_suffix === "a partir de" ? "A partir de " : ""}
                    {money(product.base_price)}
                    {product.price_suffix && product.price_suffix !== "a partir de" ? (
                      <small> · {product.price_suffix}</small>
                    ) : null}
                  </strong>
                </div>
                <ProductDetails product={product} />
                <button onClick={() => openRequest(product)}>
                  Quero esta opção <ArrowRight />
                </button>
              </article>
            )})}
          </div>
        ) : (
          <p>Nenhuma opção publicada nesta categoria.</p>
        )}
      </section>

      {selected ? (
        <section className="commercial-request" id="solicitar-encomenda">
          <div className="commercial-request-copy">
            <span>Sua solicitação</span>
            <h2>{selected.name}</h2>
            <p>
              Isto ainda não é cobrança nem confirmação definitiva. A equipe revisará os
              detalhes, o horário e o valor antes do sinal.
            </p>
            <div>
              <Clock3 /> Antecedência mínima: {selected.lead_business_days} dia(s) útil(eis)
            </div>
            <div>
              <ShieldCheck /> Dados visíveis somente para a equipe autorizada
            </div>
          </div>

          {result?.accepted ? (
            <div className="commercial-success" role="status">
              <PackageCheck />
              <span>Pré-reserva registrada</span>
              <h3>{result.request_number}</h3>
              <p>{result.message}</p>
              <a href={whatsappUrl} target="_blank" rel="noreferrer">
                <MessageCircle /> Continuar no WhatsApp
              </a>
              <button onClick={() => setSelected(null)}>Ver outras opções</button>
            </div>
          ) : (
            <form onSubmit={submit}>
              <div className="commercial-form-grid">
                <label>
                  Seu nome
                  <input
                    required
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    autoComplete="name"
                  />
                </label>
                <label>
                  WhatsApp com DDD
                  <input
                    required
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                    inputMode="tel"
                    autoComplete="tel"
                  />
                </label>
                <label>
                  E-mail <small>(opcional)</small>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    autoComplete="email"
                  />
                </label>
                <label>
                  Quantidade
                  <input
                    required
                    type="number"
                    min={selected.minimum_quantity}
                    value={form.quantity}
                    onChange={(event) => setForm({ ...form, quantity: Number(event.target.value) })}
                  />
                </label>
                <label>
                  Data desejada
                  <input
                    required
                    type="date"
                    min={businessDateAfter(new Date(), selected.lead_business_days)}
                    value={form.date}
                    onChange={(event) => setForm({ ...form, date: event.target.value })}
                  />
                </label>
                <label>
                  Horário desejado
                  <input
                    required
                    type="time"
                    value={form.time}
                    onChange={(event) => setForm({ ...form, time: event.target.value })}
                  />
                </label>
              </div>
              <label>
                Local ou referência <small>(quando aplicável)</small>
                <input
                  value={form.location}
                  onChange={(event) => setForm({ ...form, location: event.target.value })}
                  placeholder="Bairro, escola ou local do evento"
                />
              </label>
              <label>
                Suas escolhas
                <textarea
                  value={form.preferences}
                  onChange={(event) => setForm({ ...form, preferences: event.target.value })}
                  placeholder="Ex.: massa de chocolate, recheios Ninho e brigadeiro; tema e cores..."
                />
              </label>
              <label>
                Observações
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  placeholder="Conte o que é importante para a equipe preparar o orçamento."
                />
              </label>
              <label className="commercial-consent">
                <input
                  type="checkbox"
                  checked={form.privacy}
                  onChange={(event) => setForm({ ...form, privacy: event.target.checked })}
                />
                <span>
                  Li a <a href="/#privacidade">Política de Privacidade</a> e autorizo o contato
                  sobre esta solicitação.
                </span>
              </label>
              {notice ? <p className="commercial-notice" role="alert">{notice}</p> : null}
              <button className="commercial-submit" disabled={submitting}>
                {submitting ? "Verificando agenda..." : "Solicitar pré-reserva"} <ArrowRight />
              </button>
            </form>
          )}
        </section>
      ) : null}

      <section className="commercial-policy">
        <Sparkles />
        <div>
          <h2>Como a confirmação funciona</h2>
          <p>
            A pré-reserva dura 48 horas e gera um alerta para a equipe. Quando houver mais
            de um interesse no mesmo período, a preferência será de quem confirmar primeiro
            com o sinal de 50%.
          </p>
        </div>
        <MapPin />
        <div>
          <h2>Retirada e atendimento</h2>
          <p>
            Encomendas comuns são retiradas no Passaré. Serviços externos e condições de
            deslocamento aparecem em cada opção e são confirmados no orçamento.
          </p>
        </div>
        <Sparkles />
        <div>
          <h2>Cancelamentos</h2>
          <p>
            Com 7 dias úteis ou mais, devolução integral. De 3 a 6 dias úteis,
            devolução de 50% ou crédito integral. Com menos de 3 dias úteis, não há
            devolução, mas o valor fica como crédito integral.
          </p>
        </div>
      </section>

      <footer>
        <Brand subtitle={experienceCopy[segment].label} />
        <p>Adoce Brigaderia · Fortaleza, Ceará</p>
      </footer>
    </main>
  );
}
