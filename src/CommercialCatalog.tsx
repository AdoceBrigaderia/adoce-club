import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
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
  CommercialRequestField,
  CommercialEventSubcategory,
  CommercialProduct,
  CommercialProductOption,
  CommercialSegment,
  eventSubcategoryLabels,
  formatCommercialDate,
  leadTimeMessage,
  money,
  normalizeBrazilianPhone,
  segmentLabels,
  ServiceRequestResult,
  validateCommercialRequest,
} from "./commercial";
import CommercialMediaCarousel from "./CommercialMediaCarousel";
import type { CommercialMediaItem } from "./commercial-media";
import "./commercial-catalog.css";
import "./commercial-product-options.css";
import "./commercial-editorial.css";
import "./commercial-validation.css";
import { trackPublicEvent } from "./analytics";

const segments = Object.keys(segmentLabels) as CommercialSegment[];
type SegmentMedia = {
  segment: CommercialSegment;
  image_url: string;
  alt_text: string;
};

const segmentFallbackMedia: Record<CommercialSegment, SegmentMedia> = {
  cakes: { segment: "cakes", image_url: "/adoce-hoje/torta-chocolatudo.webp", alt_text: "Torta artesanal de chocolate produzida pela Adoce" },
  sweets: { segment: "sweets", image_url: "/adoce-hoje/docinhos-tradicionais.webp", alt_text: "Docinhos artesanais tradicionais da Adoce" },
  events: { segment: "events", image_url: "/adoce-hoje/tabuleiro-doces.webp", alt_text: "Atendimento real com o Tabuleiro de Doces da Adoce" },
  school: { segment: "school", image_url: "/adoce-hoje/adoce-na-escola.webp", alt_text: "Comemoração real organizada pela Adoce em uma escola" },
  rentals: { segment: "rentals", image_url: "/adoce-hoje/festas-eventos.webp", alt_text: "Decoração real montada com peças disponíveis para locação" },
};

// A galeria principal já apresenta a mídia da categoria sem repeti-la abaixo.
const singleImageSegments = new Set<CommercialSegment>();
const categoryOnlyMediaSegments = new Set<CommercialSegment>(["events", "school", "rentals"]);

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

type ExperienceCopy = {
  label: string;
  title: string;
  text: string;
  cta: string;
  compareTitle: string;
  proofTitle: string;
  proofText: string;
  steps: [string, string, string];
};

const experienceCopy: Record<CommercialSegment, ExperienceCopy> = {
  cakes: {
    label: "Tortas artesanais por encomenda",
    title: "A torta certa começa pelo tamanho do seu momento.",
    text: "Escolha quantas pessoas vão celebrar. Depois, combine massa e recheios com a Adoce.",
    cta: "Ver qual tamanho combina",
    compareTitle: "Encontre o tamanho do seu momento",
    proofTitle: "Você escolhe. A gente faz do zero.",
    proofText: "Cada torta é preparada artesanalmente para a data combinada, com acabamento alinhado antes da produção.",
    steps: ["Escolha o tamanho", "Combine massa e recheios", "Confirme a data e o acabamento"],
  },
  sweets: {
    label: "Docinhos feitos um a um",
    title: "Feitos um a um. Escolhidos mais de uma vez.",
    text: "Veja os docinhos por inteiro, escolha entre tradicionais e especiais e monte a quantidade da sua comemoração.",
    cta: "Comparar docinhos",
    compareTitle: "Compare as opções",
    proofTitle: "Pequenos no tamanho. Enormes no cuidado.",
    proofText: "Produção artesanal, sabores escolhidos por você e docinhos apresentados por inteiro para facilitar a sua escolha.",
    steps: ["Escolha a linha", "Defina quantidade e sabores", "Confirme a data da encomenda"],
  },
  events: {
    label: "Festas e eventos",
    title: "O doce vai até os convidados. A experiência fica na festa.",
    text: "No Tabuleiro, a Adoce circula e serve durante o evento. Nas Mini Festas, você escolhe uma celebração compacta e cheia de carinho.",
    cta: "Escolher a experiência",
    compareTitle: "Escolha a experiência",
    proofTitle: "Veja como cada experiência funciona.",
    proofText: "Quantidade, duração, deslocamento e tudo o que está incluído aparecem antes de você solicitar.",
    steps: ["Escolha Tabuleiro ou Mini Festa", "Compare formato e valor", "Conte a data e o local"],
  },
  school: {
    label: "Adoce na Escola",
    title: "Cabe no recreio. Fica na memória.",
    text: "Escolha o formato da comemoração e leve para a escola uma experiência gostosa, bonita e organizada para as crianças.",
    cta: "Ver pacotes para a escola",
    compareTitle: "Escolha como celebrar",
    proofTitle: "Pensado para a rotina da escola.",
    proofText: "Você encontra o que cada pacote inclui, a quantidade de crianças e a antecedência necessária.",
    steps: ["Escolha o pacote", "Informe turma e quantidade", "Alinhe data e personalização"],
  },
  rentals: {
    label: "Aluguel de decoração",
    title: "Sua festa bonita sem precisar comprar tudo.",
    text: "Escolha peças e kits da Adoce, retire no período combinado e monte uma comemoração com a sua cara.",
    cta: "Conhecer os kits",
    compareTitle: "Encontre o kit certo",
    proofTitle: "Veja cada peça antes de escolher.",
    proofText: "As fotos apresentam as montagens, e a gente confirma peças, período, retirada, devolução e disponibilidade antes do sinal.",
    steps: ["Escolha o kit", "Confira peças e período", "Confirme retirada e devolução"],
  },
};

const catalogIntroCopy: Record<CommercialSegment, string> = {
  cakes: "Escolha o tamanho e descubra tudo o que pode deixar sua torta com a cara da celebração.",
  sweets: "Veja os docinhos por inteiro, compare os pacotes e escolha os sabores que vão completar a mesa.",
  events: "Escolha entre o Tabuleiro de Doces servido durante o evento e as Mini Festas compactas, personalizadas e prontas para celebrar.",
  school: "A foto mostra uma comemoração real. Compare os pacotes e escolha o nível de experiência para a turma.",
  rentals: "A foto mostra uma montagem real. Compare os kits e veja quais peças fazem sentido para a sua festa.",
};

const eventSubcategoryCopy: Record<CommercialEventSubcategory, string> = {
  trays: "Uma experiência conduzida pela Adoce durante a festa. Escolha a quantidade de colheres que combina com o número de convidados.",
  mini_parties: "Soluções compactas para celebrar com beleza e praticidade, reunindo doces, bolo e decoração em uma proposta completa.",
};

const miniPartyExperience: ExperienceCopy = {
  ...experienceCopy.events,
  label: "Mini Festas Adoce",
  title: "Uma festa inteira, no tamanho certo para o seu momento.",
  text: "Bolo, doces e decoração reunidos em formatos compactos para celebrar com beleza, carinho e praticidade.",
  cta: "Escolher uma Mini Festa",
  compareTitle: "Escolha sua Mini Festa",
  proofTitle: "Compacta no formato. Completa na intenção.",
  proofText: "Você confere o que está incluído, o valor inicial e as possibilidades de personalização antes de solicitar.",
  steps: ["Escolha o formato", "Confira o que está incluído", "Alinhe tema, data e local"],
};

const segmentRoutes: Record<CommercialSegment, string> = {
  cakes: "#encomendas",
  sweets: "#docinhos",
  events: "#eventos",
  school: "#adoce-na-escola",
  rentals: "#aluguel-decoracao",
};

export default function CommercialCatalog({ initialSegment = "cakes" }: { initialSegment?: CommercialSegment }) {
  const [products, setProducts] = useState<CommercialProduct[]>([]);
  const [segmentMedia, setSegmentMedia] = useState<SegmentMedia[]>([]);
  const [galleryMedia, setGalleryMedia] = useState<CommercialMediaItem[]>([]);
  const [segment, setSegment] = useState<CommercialSegment>(initialSegment);
  const [eventSubcategory, setEventSubcategory] = useState<CommercialEventSubcategory>("trays");
  const [selected, setSelected] = useState<CommercialProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [catalogReload, setCatalogReload] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<CommercialRequestField, string>>>({});
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
  const minimumDate = selected ? businessDateAfter(new Date(), selected.lead_business_days) : "";
  const clearFieldError = (field: CommercialRequestField) => {
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setNotice("");
  };

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setCatalogError("");
      const [productResult, optionResult, mediaResult, galleryResult] = await Promise.all([
        requireSupabase().from("commercial_products").select("*").eq("active", true).eq("published", true).order("sort_order"),
        requireSupabase().from("commercial_product_options").select("*").eq("active", true).order("sort_order"),
        requireSupabase().from("commercial_segment_media").select("segment,image_url,alt_text"),
        requireSupabase().from("commercial_media_items").select("*").eq("active", true).order("sort_order"),
      ]);
      if (productResult.error || optionResult.error) setCatalogError("Não conseguimos abrir as opções agora. Sua comemoração continua importante para a gente — tente novamente ou fale com a Adoce pelo WhatsApp.");
      else {
        const options = (optionResult.data || []) as CommercialProductOption[];
        setProducts(((productResult.data || []) as CommercialProduct[]).map((product) => ({
          ...product,
          options: options.filter((option) => option.product_id === product.id),
        })));
        if (!mediaResult.error) setSegmentMedia((mediaResult.data || []) as SegmentMedia[]);
        if (!galleryResult.error) setGalleryMedia((galleryResult.data || []) as CommercialMediaItem[]);
      }
      setLoading(false);
    })();
  }, [catalogReload]);

  useEffect(() => setSegment(initialSegment), [initialSegment]);

  const visibleProducts = useMemo(
    () => products.filter((product) =>
      product.segment === segment
      && (segment !== "events" || product.subcategory === eventSubcategory)),
    [eventSubcategory, products, segment],
  );
  const activeEventProduct = segment === "events" && eventSubcategory === "mini_parties"
    ? products.find((product) => product.segment === "events" && product.subcategory === "mini_parties")
    : null;
  const activeEventProductMedia = activeEventProduct ? catalogProductImage(activeEventProduct) : null;
  const activeMedia = activeEventProductMedia
    ? {
        segment: "events" as const,
        image_url: activeEventProductMedia,
        alt_text: "Mini festa real montada pela Adoce",
      }
    : segmentMedia.find((item) => item.segment === segment) || segmentFallbackMedia[segment];
  const activeExperience = segment === "events" && eventSubcategory === "mini_parties"
    ? miniPartyExperience
    : experienceCopy[segment];
  const activeGallery = activeEventProduct
    ? galleryMedia.filter((item) => item.product_id === activeEventProduct.id)
    : galleryMedia.filter((item) => item.segment === segment);
  const productGallery = (productId: string) => galleryMedia.filter((item) => item.product_id === productId);

  const openRequest = (product: CommercialProduct) => {
    trackPublicEvent("product_view", { product_id: product.id, product_slug: product.slug, segment: product.segment });
    trackPublicEvent("prebook_start", { product_id: product.id, product_slug: product.slug, segment: product.segment });
    setSelected(product);
    setResult(null);
    setNotice("");
    setFieldErrors({});
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

  const changeSegment = (nextSegment: CommercialSegment) => {
    setSegment(nextSegment);
    setSelected(null);
    setResult(null);
    setNotice("");
    setFieldErrors({});
    const nextHash = segmentRoutes[nextSegment];
    if (window.location.hash !== nextHash) window.location.hash = nextHash;
  };

  const changeEventSubcategory = (nextSubcategory: CommercialEventSubcategory) => {
    setEventSubcategory(nextSubcategory);
    setSelected(null);
    setResult(null);
    setNotice("");
    setFieldErrors({});
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    const errors = validateCommercialRequest(
      form,
      selected.minimum_quantity,
      minimumDate,
      selected.lead_business_days,
    );
    const firstInvalidField = (Object.keys(errors) as CommercialRequestField[])[0];
    if (firstInvalidField) {
      trackPublicEvent("prebook_error", { product_id: selected.id, product_slug: selected.slug, segment: selected.segment, result: "validation" });
      setFieldErrors(errors);
      setNotice("Falta só um pequeno ajuste. Confira o campo indicado para enviarmos sua solicitação.");
      requestAnimationFrame(() => document.getElementById(`commercial-${firstInvalidField}`)?.focus());
      return;
    }
    setFieldErrors({});
    const phone = normalizeBrazilianPhone(form.phone);
    const start = new Date(`${form.date}T${form.time}:00-03:00`);
    const durationHours = selected.segment === "rentals" ? 48 : 2;
    const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);
    setSubmitting(true);
    setNotice("");
    trackPublicEvent("prebook_submit", { product_id: selected.id, product_slug: selected.slug, segment: selected.segment });
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
      trackPublicEvent("prebook_error", { product_id: selected.id, product_slug: selected.slug, segment: selected.segment, result: "database" });
      const friendlyError = /antecedência mínima/i.test(error.message)
        ? leadTimeMessage(selected.lead_business_days, minimumDate)
        : /data ou horário inválido/i.test(error.message)
          ? "Não conseguimos reconhecer essa data ou esse horário. Confira os campos e tente novamente."
          : /quantidade mínima/i.test(error.message)
            ? `Esta opção começa com ${selected.minimum_quantity} unidade(s).`
            : "Não conseguimos registrar a pré-reserva agora. Tente novamente em instantes ou fale com a Adoce pelo WhatsApp para não perder sua data.";
      if (/antecedência mínima/i.test(error.message)) setFieldErrors({ date: friendlyError });
      setNotice(friendlyError);
      return;
    }
    const nextResult = data as ServiceRequestResult;
    setResult(nextResult);
    trackPublicEvent(nextResult.accepted ? "prebook_success" : "prebook_error", {
      product_id: selected.id,
      product_slug: selected.slug,
      segment: selected.segment,
      result: nextResult.accepted ? "accepted" : "rejected",
    });
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
        <Brand subtitle={activeExperience.label} />
        <a href="/#inicio">
          <ArrowLeft /> Voltar ao site
        </a>
      </header>

      <section className={`commercial-hero segment-${segment}${segment === "events" ? ` event-${eventSubcategory}` : ""}${segment === "sweets" ? " without-media" : ""}`}>
        <div className="commercial-hero-copy">
          <span>{activeExperience.label}</span>
          <h1>{activeExperience.title}</h1>
          <p>{activeExperience.text}</p>
          <button type="button" onClick={() => document.getElementById("opcoes-comerciais")?.scrollIntoView({ behavior: "smooth" })}>
            {activeExperience.cta} <ArrowRight />
          </button>
        </div>
        {segment !== "sweets" ? <div className="commercial-hero-media">
          <CommercialMediaCarousel items={activeGallery} fallbackImage={activeMedia.image_url} fallbackAlt={activeMedia.alt_text} label={activeExperience.label} />
        </div> : null}
        <aside className="commercial-hero-compare" aria-label={activeExperience.compareTitle}>
          <h2>{activeExperience.compareTitle}</h2>
          {loading ? <p>Carregando opções...</p> : visibleProducts.slice(0, 4).map((product) => (
            <button type="button" key={product.id} onClick={() => openRequest(product)}>
              <span>
                <strong>{product.name}</strong>
                <small>{product.short_description}</small>
              </span>
              <b>{money(product.base_price)}</b>
            </button>
          ))}
          {!loading && visibleProducts.length === 0 ? <p>As opções desta categoria serão publicadas em breve.</p> : null}
        </aside>
      </section>

      <section className="commercial-choice-flow" aria-label="Como escolher">
        <div>
          <span>O que você escolhe</span>
          <h2>{activeExperience.proofTitle}</h2>
          <p>{activeExperience.proofText}</p>
        </div>
        <ol>
          {activeExperience.steps.map((step, index) => <li key={step}><b>{index + 1}</b><span>{step}</span></li>)}
        </ol>
      </section>

      <div className="commercial-proof-strip" aria-label="Diferenciais da Adoce">
        <span><Sparkles /> Feito artesanalmente</span>
        <span><Heart /> Fotos dos produtos e serviços</span>
        <span><MessageCircle /> Atendimento próximo pelo WhatsApp</span>
      </div>

      <nav className="commercial-segments" aria-label="Categorias de encomendas">
        {segments.map((item) => (
          <button
            key={item}
            className={segment === item ? "active" : ""}
            onClick={() => changeSegment(item)}
          >
            {segmentLabels[item]}
          </button>
        ))}
      </nav>

      <section className="commercial-catalog" id="opcoes-comerciais" aria-live="polite">
        {catalogError ? <div className="commercial-catalog-error" role="alert">
          <Heart />
          <div><strong>As opções não carregaram desta vez.</strong><p>{catalogError}</p></div>
          <button type="button" onClick={() => setCatalogReload((value) => value + 1)}>Tentar novamente</button>
          <a href="https://wa.me/5585981994370?text=Ol%C3%A1!%20N%C3%A3o%20consegui%20ver%20as%20op%C3%A7%C3%B5es%20no%20site%20e%20gostaria%20de%20atendimento." target="_blank" rel="noreferrer">Falar no WhatsApp</a>
        </div> : null}
        {segment === "events" ? (
          <nav className="commercial-subcategories" aria-label="Tipos de eventos">
            {(Object.keys(eventSubcategoryLabels) as CommercialEventSubcategory[]).map((item) => (
              <button
                key={item}
                className={eventSubcategory === item ? "active" : ""}
                aria-pressed={eventSubcategory === item}
                onClick={() => changeEventSubcategory(item)}
              >
                <span>{eventSubcategoryLabels[item]}</span>
                <small>{item === "trays" ? "Serviço durante a festa" : "Celebrações compactas"}</small>
              </button>
            ))}
          </nav>
        ) : null}
        <div className="commercial-section-title">
          <span>{segmentLabels[segment]}</span>
          <h2>
            {segment === "cakes"
              ? "Tortas inteiras"
              : segment === "events"
                ? eventSubcategoryLabels[eventSubcategory]
                : segmentLabels[segment]}
          </h2>
          <p>
            {segment === "events" ? eventSubcategoryCopy[eventSubcategory] : catalogIntroCopy[segment]}
          </p>
        </div>
        {singleImageSegments.has(segment) ? (
          <figure className={`commercial-segment-showcase showcase-${segment}`}>
            <img src={activeMedia.image_url} alt={activeMedia.alt_text} />
            <figcaption>
              <strong>
                {segment === "events" && eventSubcategory === "mini_parties"
                  ? "Mini festa real Adoce"
                  : "Experiência real Adoce"}
              </strong>
              <span>A apresentação pode variar conforme tema, local, escolhas e disponibilidade.</span>
            </figcaption>
          </figure>
        ) : null}
        {loading ? (
          <p>Carregando opções...</p>
        ) : visibleProducts.length ? (
          <div className="commercial-product-list">
            {visibleProducts.map((product) => {
              const productImage = catalogProductImage(product);
              const itemGallery = productGallery(product.id);
              const showProductGallery = !categoryOnlyMediaSegments.has(segment)
                && itemGallery.length > 0
                && activeEventProduct?.id !== product.id;
              const showProductMedia = showProductGallery
                || (!categoryOnlyMediaSegments.has(segment) && Boolean(productImage));
              return (
              <article className={showProductMedia ? "with-image" : ""} key={product.id}>
                {showProductMedia ? <CommercialMediaCarousel items={itemGallery} fallbackImage={productImage} fallbackAlt={product.name} label={product.name} /> : null}
                <div className="commercial-product-main">
                  <span>
                    {product.segment === "events" && product.subcategory
                      ? eventSubcategoryLabels[product.subcategory]
                      : segmentLabels[product.segment]}
                  </span>
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
              Isto ainda não é cobrança nem confirmação definitiva. A Adoce confirma com você
              os detalhes, o horário e o valor antes do sinal.
            </p>
            <div>
              <Clock3 /> Antecedência mínima: {selected.lead_business_days} dia(s) útil(eis)
            </div>
            <div>
              <ShieldCheck /> Seus dados são protegidos e usados somente nesta solicitação
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
            <form onSubmit={submit} noValidate>
              <div className="commercial-form-grid">
                <label>
                  Seu nome
                  <input
                    id="commercial-name"
                    required
                    value={form.name}
                    aria-invalid={Boolean(fieldErrors.name)}
                    onChange={(event) => { setForm({ ...form, name: event.target.value }); clearFieldError("name"); }}
                    autoComplete="name"
                  />
                  {fieldErrors.name ? <small className="commercial-field-error" role="alert">{fieldErrors.name}</small> : null}
                </label>
                <label>
                  WhatsApp com DDD
                  <input
                    id="commercial-phone"
                    required
                    value={form.phone}
                    aria-invalid={Boolean(fieldErrors.phone)}
                    onChange={(event) => { setForm({ ...form, phone: event.target.value }); clearFieldError("phone"); }}
                    inputMode="tel"
                    autoComplete="tel"
                  />
                  {fieldErrors.phone ? <small className="commercial-field-error" role="alert">{fieldErrors.phone}</small> : null}
                </label>
                <label>
                  E-mail <small>(opcional)</small>
                  <input
                    id="commercial-email"
                    type="email"
                    value={form.email}
                    aria-invalid={Boolean(fieldErrors.email)}
                    onChange={(event) => { setForm({ ...form, email: event.target.value }); clearFieldError("email"); }}
                    autoComplete="email"
                  />
                  {fieldErrors.email ? <small className="commercial-field-error" role="alert">{fieldErrors.email}</small> : null}
                </label>
                <label>
                  Quantidade
                  <input
                    id="commercial-quantity"
                    required
                    type="number"
                    min={selected.minimum_quantity}
                    value={form.quantity}
                    aria-invalid={Boolean(fieldErrors.quantity)}
                    onChange={(event) => { setForm({ ...form, quantity: Number(event.target.value) }); clearFieldError("quantity"); }}
                  />
                  {fieldErrors.quantity ? <small className="commercial-field-error" role="alert">{fieldErrors.quantity}</small> : null}
                </label>
                <label>
                  Data desejada
                  <input
                    id="commercial-date"
                    required
                    type="date"
                    min={minimumDate}
                    value={form.date}
                    aria-invalid={Boolean(fieldErrors.date)}
                    aria-describedby="commercial-date-guidance"
                    onInput={(event) => {
                      const date = event.currentTarget.value;
                      setForm({ ...form, date });
                      setNotice("");
                      setFieldErrors((current) => ({
                        ...current,
                        date: date && date < minimumDate
                          ? leadTimeMessage(selected.lead_business_days, minimumDate)
                          : undefined,
                      }));
                    }}
                  />
                  <span className="commercial-date-guidance" id="commercial-date-guidance">
                    <Clock3 /> Primeira data disponível: <strong>{formatCommercialDate(minimumDate)}</strong>
                  </span>
                  {fieldErrors.date ? <span className="commercial-date-error" role="alert">
                    <strong>{fieldErrors.date}</strong>
                    <button type="button" onClick={() => {
                      setForm({ ...form, date: minimumDate });
                      clearFieldError("date");
                    }}>Usar esta primeira data</button>
                  </span> : null}
                </label>
                <label>
                  Horário desejado
                  <input
                    id="commercial-time"
                    required
                    type="time"
                    value={form.time}
                    aria-invalid={Boolean(fieldErrors.time)}
                    onChange={(event) => { setForm({ ...form, time: event.target.value }); clearFieldError("time"); }}
                  />
                  {fieldErrors.time ? <small className="commercial-field-error" role="alert">{fieldErrors.time}</small> : null}
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
                  placeholder="Conte o que é importante para prepararmos sua comemoração."
                />
              </label>
              <label className="commercial-consent">
                <input
                  id="commercial-privacy"
                  type="checkbox"
                  checked={form.privacy}
                  aria-invalid={Boolean(fieldErrors.privacy)}
                  onChange={(event) => { setForm({ ...form, privacy: event.target.checked }); clearFieldError("privacy"); }}
                />
                <span>
                  Li a <a href="/#privacidade">Política de Privacidade</a> e autorizo o contato
                  sobre esta solicitação.
                </span>
              </label>
              {fieldErrors.privacy ? <small className="commercial-field-error" role="alert">{fieldErrors.privacy}</small> : null}
              {notice ? <p className="commercial-notice" role="alert">{notice}</p> : null}
              <button className="commercial-submit" disabled={submitting}>
                {submitting ? "Enviando solicitação..." : "Solicitar pré-reserva"} <ArrowRight />
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
            A pré-reserva dura 48 horas. Quando houver mais de um interesse no mesmo período,
            a preferência será de quem confirmar primeiro com o sinal de 50%.
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
        <Brand subtitle={activeExperience.label} />
        <p>Adoce Brigaderia · Fortaleza, Ceará</p>
      </footer>
    </main>
  );
}
