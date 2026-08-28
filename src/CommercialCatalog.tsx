import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CakeSlice,
  Check,
  Clock3,
  Heart,
  Images,
  MessageCircle,
  PackageCheck,
  ShieldCheck,
  X,
} from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import {
  businessDateAfter,
  commercialProductPriceLabel,
  commercialWhatsAppMessage,
  CommercialRequestField,
  CommercialEventSubcategory,
  CommercialProduct,
  CommercialProductOption,
  PreorderBusinessHour,
  PreorderBusinessHourException,
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
import "./commercial-gallery.css";
import "./commercial-reference-2026.css";
import { trackPublicEvent } from "./analytics";
import { orderWhatsAppUrl, useOrderWhatsAppNumber } from "./order-whatsapp";
import PublicCatalogNav from "./PublicCatalogNav";
import ProductImageViewer, { type ProductImage } from "./ProductImageViewer";
import ExperienciaAdoce from "./ExperienciaAdoce";
import type { Experiencia } from "./experiencias-adoce";
import type { Produto } from "./catalogo-de-encomendas";
import {
  ajustarParaMultiplo,
  descreverComposicao,
  ehQuantidadeValida,
  MULTIPLO,
} from "./pacotes-de-docinhos";

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
const categoryOnlyMediaSegments = new Set<CommercialSegment>(["cakes", "events", "school", "rentals"]);
const categoryGallerySegments = new Set<CommercialSegment>(["events", "rentals"]);

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

function ProductDetails({ product }: { product: CommercialProduct }) {
  return (
    <div className="commercial-product-details">
      {product.segment !== "sweets" && product.details.packages?.length ? (
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
  cta: string;
  compareTitle: string;
};

const catalogPresentation: Record<CommercialSegment, {
  title: string;
  link?: string;
  search: string;
  action: string;
  filters: string[];
}> = {
  cakes: { title: "Tortas", search: "Buscar torta...", action: "Encomendar", filters: ["Tradicionais", "Premium", "Kits festa"] },
  sweets: { title: "Docinhos", search: "Buscar docinho...", action: "Encomendar", filters: ["Brigadeiros", "Caixas", "Kits festa"] },
  events: { title: "Eventos", search: "Buscar evento...", action: "Solicitar orçamento", filters: ["Todos", "Tabuleiro", "Mini Festas"] },
  school: { title: "Adoce na Escola", link: "Opções para lanche e comemorações", search: "Buscar opção...", action: "Encomendar", filters: ["Lanche", "Comemoração", "Lembrancinhas"] },
  rentals: { title: "Aluguel de decoração", search: "Buscar decoração...", action: "Reservar", filters: ["Temas", "Mobiliário", "Kits completos"] },
};

function matchesCatalogFilter(product: CommercialProduct, filter: string) {
  const haystack = `${product.name} ${product.short_description} ${product.description}`.toLocaleLowerCase("pt-BR");
  if (["Tradicionais", "Brigadeiros", "Todos", "Temas", "Lanche"].includes(filter)) return true;
  if (filter === "Premium") return /premium|especial|gourmet/.test(haystack);
  if (filter === "Caixas") return /caixa|presente/.test(haystack);
  if (filter === "Kits festa" || filter === "Kits completos") return /kit|completo/.test(haystack);
  if (filter === "Tabuleiro") return product.subcategory === "trays" || /tabuleiro/.test(haystack);
  if (filter === "Mini Festas") return product.subcategory === "mini_parties" || /mini festa/.test(haystack);
  if (filter === "Mobiliário") return /mobili|mesa|painel|peça/.test(haystack);
  if (filter === "Comemoração") return /anivers|comemora|festa/.test(haystack);
  if (filter === "Lembrancinhas") return /lembran|mimo|presente/.test(haystack);
  return true;
}

const experienceCopy: Record<CommercialSegment, ExperienceCopy> = {
  cakes: {
    label: "Tortas artesanais por encomenda",
    title: "A torta certa começa pelo tamanho do seu momento.",
    cta: "Ver qual tamanho combina",
    compareTitle: "Encontre o tamanho do seu momento",
  },
  sweets: {
    label: "Docinhos feitos um a um",
    title: "Feitos um a um. Escolhidos mais de uma vez.",
    cta: "Comparar docinhos",
    compareTitle: "Compare as opções",
  },
  events: {
    label: "Festas e eventos",
    title: "O doce vai até os convidados. A experiência fica na festa.",
    cta: "Escolher a experiência",
    compareTitle: "Escolha a experiência",
  },
  school: {
    label: "Adoce na Escola",
    title: "Cabe no recreio. Fica na memória.",
    cta: "Ver pacotes para a escola",
    compareTitle: "Escolha como celebrar",
  },
  rentals: {
    label: "Aluguel de decoração",
    title: "Sua festa bonita sem precisar comprar tudo.",
    cta: "Conhecer os kits",
    compareTitle: "Encontre o kit certo",
  },
};

const miniPartyExperience: ExperienceCopy = {
  ...experienceCopy.events,
  label: "Mini Festas Adoce",
  title: "Uma festa inteira, no tamanho certo para o seu momento.",
  cta: "Escolher uma Mini Festa",
  compareTitle: "Escolha sua Mini Festa",
};

export default function CommercialCatalog({ initialSegment = "cakes" }: { initialSegment?: CommercialSegment }) {
  const orderWhatsAppNumber = useOrderWhatsAppNumber();
  const [products, setProducts] = useState<CommercialProduct[]>([]);
  const [viewedImage, setViewedImage] = useState<ProductImage | null>(null);
  const [segmentMedia, setSegmentMedia] = useState<SegmentMedia[]>([]);
  const [galleryMedia, setGalleryMedia] = useState<CommercialMediaItem[]>([]);
  const [preorderHours, setPreorderHours] = useState<PreorderBusinessHour[]>([]);
  const [preorderExceptions, setPreorderExceptions] = useState<PreorderBusinessHourException[]>([]);
  const [sizeGalleryOpen, setSizeGalleryOpen] = useState(false);
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
      const [productResult, optionResult, mediaResult, galleryResult, hoursResult, exceptionsResult] = await Promise.all([
        requireSupabase().from("commercial_products").select("*").eq("active", true).eq("published", true).order("sort_order"),
        requireSupabase().from("commercial_product_options").select("*").eq("active", true).order("sort_order"),
        requireSupabase().from("commercial_segment_media").select("segment,image_url,alt_text"),
        requireSupabase().from("commercial_media_items").select("*").eq("active", true).order("sort_order"),
        requireSupabase().from("business_hours").select("channel_slug,weekday,opens_at,closes_at,active").eq("channel_slug", "preorders"),
        requireSupabase().from("business_hour_exceptions").select("channel_slug,service_date,closed,opens_at,closes_at").eq("channel_slug", "preorders").gte("service_date", new Date().toISOString().slice(0, 10)),
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
        if (!hoursResult.error) setPreorderHours((hoursResult.data || []) as PreorderBusinessHour[]);
        if (!exceptionsResult.error) setPreorderExceptions((exceptionsResult.data || []) as PreorderBusinessHourException[]);
      }
      setLoading(false);
    })();
  }, [catalogReload]);

  useEffect(() => {
    setSegment(initialSegment);
    setViewedImage(null);
    setSizeGalleryOpen(false);
    setSelected(null);
    setNotice("");
    setResult(null);
  }, [initialSegment]);

  const visibleProducts = useMemo(
    () => products.filter((product) => product.segment === segment),
    [products, segment],
  );
  const displayedProducts = visibleProducts;
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
  const sweetPackages = useMemo(() => products
    .filter((product) => product.segment === "sweets")
    .flatMap((product) => product.details.packages || [])
    .filter((item, index, all) => all.findIndex((candidate) => candidate.quantity === item.quantity) === index)
    .sort((a, b) => a.quantity - b.quantity), [products]);
  const cakeGalleryGroups = useMemo(() => visibleProducts
    .filter((product) => product.segment === "cakes")
    .map((product) => {
      const media = productGallery(product.id)
        .map((item) => ({ src: item.image_url || item.original_image_url, alt: item.alt_text || product.name }))
        .filter((item): item is { src: string; alt: string } => Boolean(item.src));
      const fallback = catalogProductImage(product);
      return {
        id: product.id,
        name: product.name,
        media: media.length ? media : fallback ? [{ src: fallback, alt: product.name }] : [],
      };
    })
    .filter((group) => group.media.length), [visibleProducts, galleryMedia]);
  const openRequest = (product: CommercialProduct) => {
    trackPublicEvent("product_view", { product_id: product.id, product_slug: product.slug, segment: product.segment });
    trackPublicEvent("prebook_start", { product_id: product.id, product_slug: product.slug, segment: product.segment });
    setSelected(product);
    setResult(null);
    setNotice("");
    setFieldErrors({});
    setForm((current) => ({
      ...current,
      quantity: product.segment === "sweets"
        ? ajustarParaMultiplo(Math.max(MULTIPLO, product.minimum_quantity))
        : product.minimum_quantity,
      date: businessDateAfter(new Date(), product.lead_business_days),
      preferences: "",
      notes: "",
    }));
    requestAnimationFrame(() =>
      document.getElementById("solicitar-encomenda")?.scrollIntoView({ behavior: "smooth" }),
    );
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
      { hours: preorderHours, exceptions: preorderExceptions },
    );
    if (selected.segment === "sweets" && !ehQuantidadeValida(form.quantity)) {
      errors.quantity = "Docinhos são vendidos somente em múltiplos de 25 unidades.";
    }
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
    ? orderWhatsAppUrl(orderWhatsAppNumber, commercialWhatsAppMessage(selected, result?.request_number))
    : "";
  const presentation = catalogPresentation[segment];
  const viewerImages = displayedProducts.flatMap((product) => {
    const media = productGallery(product.id)
      .map((item) => ({ src: item.image_url || item.original_image_url, alt: item.alt_text || product.name }))
      .filter((item): item is ProductImage => Boolean(item.src));
    const fallback = catalogProductImage(product);
    return media.length ? media : fallback ? [{ src: fallback, alt: product.name }] : [];
  });
  const categoryGalleryEnabled = categoryGallerySegments.has(segment);
  const categoryProductIds = new Set(visibleProducts.map((product) => product.id));
  const categoryProductImages = visibleProducts.flatMap((product) => {
    const media = galleryMedia
      .filter((item) => item.product_id === product.id)
      .map((item) => ({ src: item.image_url || item.original_image_url, alt: item.alt_text || product.name }))
      .filter((item): item is ProductImage => Boolean(item.src));
    const fallback = catalogProductImage(product);
    return media.length ? media : fallback ? [{ src: fallback, alt: product.name }] : [];
  });
  const categoryGalleryImages = categoryGalleryEnabled
    ? Array.from(new Map([
      ...galleryMedia
        .filter((item) => item.segment === segment || (item.product_id ? categoryProductIds.has(item.product_id) : false))
        .map((item) => ({
          src: item.image_url || item.original_image_url,
          alt: item.alt_text || presentation.title,
        }))
        .filter((item): item is ProductImage => Boolean(item.src)),
      ...categoryProductImages,
      { src: activeMedia.image_url, alt: activeMedia.alt_text },
    ].map((item) => [item.src, item])).values())
    : [];
  const categoryCarouselItems: CommercialMediaItem[] = categoryGalleryImages.map((item, index) => ({
    id: `category-${segment}-${index}`,
    segment,
    product_id: null,
    media_type: "image",
    image_url: item.src,
    original_image_url: item.src,
    external_url: null,
    alt_text: item.alt,
    caption: "",
    sort_order: index,
    active: true,
  }));

  const experienceSegment: Experiencia | null =
    segment === "events" || segment === "school" || segment === "rentals" ? segment : null;
  if (!loading && experienceSegment && !catalogError) {
    const experienceProducts: Produto[] = visibleProducts.map((product) => ({
      id: product.id,
      segmento: product.segment,
      nome: product.name,
      resumo: product.short_description || product.description,
      preco: Number(product.base_price || 0),
      sufixo: product.price_suffix || "",
      minimo: product.minimum_quantity,
      prazoDiasUteis: product.lead_business_days,
      fotoUrl: catalogProductImage(product),
      publicado: product.published && product.active,
      ordem: product.sort_order,
    }));
    const experiencePhotos = categoryGalleryImages.map((item) => item.src);
    if (!experiencePhotos.includes(activeMedia.image_url)) experiencePhotos.unshift(activeMedia.image_url);
    return (
      <>
        <PublicCatalogNav active={segment} />
        <ExperienciaAdoce
          qual={experienceSegment}
          produtos={experienceProducts}
          fotos={experiencePhotos}
          whatsapp={orderWhatsAppNumber}
        />
      </>
    );
  }

  return (
    <main className="commercial-page">

      <PublicCatalogNav active={segment} />

      <section className="commercial-reference" aria-live="polite">
        <header className="commercial-reference-heading">
          <span>CATÁLOGO ADOCE</span>
          <h1>{presentation.title}</h1>
          {presentation.link ? (
            <button type="button" onClick={() => document.querySelector(".commercial-reference-grid")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
              <CakeSlice aria-hidden="true" /> {presentation.link}
            </button>
          ) : null}
          {segment === "cakes" ? (
            <button className="commercial-reference-gallery" type="button" onClick={() => setSizeGalleryOpen(true)}>
              <Images aria-hidden="true" /> Galeria de imagens
            </button>
          ) : null}
          {categoryGalleryEnabled && categoryGalleryImages.length ? (
            <button className="commercial-reference-gallery" type="button" onClick={() => setViewedImage(categoryGalleryImages[0])}>
              <Images aria-hidden="true" /> Galeria de imagens
            </button>
          ) : null}
        </header>

        {catalogError ? <div className="commercial-catalog-error" role="alert">
          <Heart />
          <div><strong>As opções não carregaram desta vez.</strong><p>{catalogError}</p></div>
          <button type="button" onClick={() => setCatalogReload((value) => value + 1)}>Tentar novamente</button>
        </div> : null}

        {!loading && categoryGalleryEnabled ? (
          <div className="commercial-reference-category-carousel">
            <CommercialMediaCarousel
              items={categoryCarouselItems}
              fallbackImage={activeMedia.image_url}
              fallbackAlt={activeMedia.alt_text}
              label={presentation.title}
            />
          </div>
        ) : null}

        {loading ? <p>Carregando opções...</p> : displayedProducts.length ? (
          <div className="commercial-reference-grid">
            {displayedProducts.map((product) => {
              const itemGallery = productGallery(product.id)
                .map((item) => ({ src: item.image_url || item.original_image_url, alt: item.alt_text || product.name }))
                .filter((item): item is ProductImage => Boolean(item.src));
              const fallback = catalogProductImage(product);
              const primaryImage = itemGallery[0] || (fallback ? { src: fallback, alt: product.name } : null);
              return (
                <article key={product.id} className={categoryGalleryEnabled ? "without-product-image" : undefined}>
                  {!categoryGalleryEnabled && primaryImage ? (
                    <button className="commercial-reference-image" type="button" onClick={() => setViewedImage(primaryImage)} aria-label={`Ampliar fotos de ${product.name}`}>
                      <img src={primaryImage.src} alt={primaryImage.alt} loading="lazy" />
                      <span aria-hidden="true"><Heart /></span>
                    </button>
                  ) : null}
                  <div className="commercial-reference-card-copy">
                    <h2>{product.name}</h2>
                    <strong>{commercialProductPriceLabel(product)}</strong>
                    <button type="button" onClick={() => openRequest(product)}><MessageCircle aria-hidden="true" /> {presentation.action}</button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : <p>Nenhum produto publicado nesta categoria.</p>}
      </section>

      <section className={`commercial-legacy-section commercial-hero segment-${segment}${segment === "events" ? ` event-${eventSubcategory}` : ""}${segment === "sweets" ? " without-media" : ""}`}>
        <div className="commercial-hero-copy">
          <span>{activeExperience.label}</span>
          <h1>{activeExperience.title}</h1>
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
              </span>
              <b>{commercialProductPriceLabel(product)}</b>
            </button>
          ))}
          {!loading && visibleProducts.length === 0 ? <p>As opções desta categoria serão publicadas em breve.</p> : null}
        </aside>
      </section>

      <section className="commercial-legacy-section commercial-catalog" id="opcoes-comerciais" aria-live="polite">
        {catalogError ? <div className="commercial-catalog-error" role="alert">
          <Heart />
          <div><strong>As opções não carregaram desta vez.</strong><p>{catalogError}</p></div>
          <button type="button" onClick={() => setCatalogReload((value) => value + 1)}>Tentar novamente</button>
          <a href={orderWhatsAppUrl(orderWhatsAppNumber, "Olá! Não consegui ver as opções no site e gostaria de atendimento.")} target="_blank" rel="noreferrer">Falar no WhatsApp</a>
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
          <span>Catálogo Adoce</span>
          <h2>
            {segment === "cakes"
              ? "Tortas"
              : segment === "events"
                ? eventSubcategoryLabels[eventSubcategory]
                : segmentLabels[segment]}
          </h2>
          {segment === "cakes" ? (
            <button className="commercial-size-gallery-button" type="button" onClick={() => setSizeGalleryOpen(true)}>
              <Images /> Galeria de imagens
            </button>
          ) : null}
          {segment === "sweets" && sweetPackages.length ? <div className="commercial-shared-packages" aria-label="Tamanhos dos pacotes">
            {sweetPackages.map((item) => <span key={item.quantity}><strong>{item.quantity}</strong> unidades</span>)}
          </div> : null}
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
                  <strong>
                    {commercialProductPriceLabel(product)}
                    {product.price_suffix
                    && product.price_suffix.toLocaleLowerCase("pt-BR") !== "a partir de"
                    && !["torta-p", "torta-m", "torta-g"].includes(product.slug) ? (
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
                    min={selected.segment === "sweets" ? MULTIPLO : selected.minimum_quantity}
                    step={selected.segment === "sweets" ? MULTIPLO : 1}
                    value={form.quantity}
                    aria-invalid={Boolean(fieldErrors.quantity)}
                    onChange={(event) => { setForm({ ...form, quantity: Number(event.target.value) }); clearFieldError("quantity"); }}
                    onBlur={() => {
                      if (selected.segment !== "sweets") return;
                      setForm((current) => ({ ...current, quantity: ajustarParaMultiplo(current.quantity) }));
                    }}
                  />
                  {selected.segment === "sweets" && ehQuantidadeValida(form.quantity) ? (
                    <small>Pacotes: {descreverComposicao(form.quantity)}.</small>
                  ) : null}
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

      {sizeGalleryOpen ? (
        <div className="commercial-size-gallery-modal" role="dialog" aria-modal="true" aria-label="Galeria de Tortas por tamanho" onClick={() => setSizeGalleryOpen(false)}>
          <section onClick={(event) => event.stopPropagation()}>
            <header>
              <div><span>Catálogo Adoce</span><h2>Galeria de Tortas</h2><p>Fotos organizadas pelo tamanho da torta.</p></div>
              <button type="button" onClick={() => setSizeGalleryOpen(false)} aria-label="Fechar galeria"><X /></button>
            </header>
            {cakeGalleryGroups.length ? cakeGalleryGroups.map((group) => (
              <div className="commercial-size-gallery-group" key={group.id}>
                <h3>{group.name}</h3>
                <div>{group.media.map((item, index) => <button className="product-image-trigger" type="button" key={`${group.id}-${index}`} onClick={() => setViewedImage(item)} aria-label={`Ampliar ${item.alt}`}><img src={item.src} alt={item.alt} loading="lazy" /></button>)}</div>
              </div>
            )) : <p>As fotos por tamanho serão adicionadas em breve.</p>}
          </section>
        </div>
      ) : null}
      <ProductImageViewer
        image={viewedImage}
        images={categoryGalleryEnabled && categoryGalleryImages.length
          ? categoryGalleryImages
          : viewerImages.length
            ? viewerImages
            : cakeGalleryGroups.flatMap((group) => group.media)}
        onClose={() => setViewedImage(null)}
      />

    </main>
  );
}
