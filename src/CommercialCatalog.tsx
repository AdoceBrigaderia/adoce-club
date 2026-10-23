import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CakeSlice,
  Check,
  Heart,
  Images,
  MessageCircle,
  X,
} from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import {
  commercialProductPriceLabel,
  commercialWhatsAppMessage,
  CommercialProduct,
  CommercialProductOption,
  CommercialSegment,
  money,
  segmentLabels,
} from "./commercial";
import CommercialMediaCarousel from "./CommercialMediaCarousel";
import type { CommercialMediaItem } from "./commercial-media";
import "./commercial-catalog.css";
import "./commercial-product-options.css";
import "./commercial-editorial.css";
import "./commercial-gallery.css";
import "./commercial-reference-2026.css";
import { trackPublicEvent } from "./analytics";
import { orderWhatsAppUrl, useOrderWhatsAppNumber } from "./order-whatsapp";
import PublicCatalogNav from "./PublicCatalogNav";
import ProductImageViewer, { type ProductImage } from "./ProductImageViewer";

type SegmentMedia = {
  segment: CommercialSegment;
  image_url: string;
  alt_text: string;
};

const segmentFallbackMedia: Record<CommercialSegment, SegmentMedia> = {
  cakes: { segment: "cakes", image_url: "/adoce-hoje/torta-chocolatudo.webp", alt_text: "Torta artesanal de chocolate produzida pela Adoce" },
  sweets: { segment: "sweets", image_url: "/adoce-hoje/docinhos-tradicionais.webp", alt_text: "Docinhos artesanais tradicionais da Adoce" },
};

// A galeria principal já apresenta a mídia da categoria sem repeti-la abaixo.
const singleImageSegments = new Set<CommercialSegment>();
const categoryOnlyMediaSegments = new Set<CommercialSegment>(["cakes"]);
const categoryGallerySegments = new Set<CommercialSegment>();

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
  cakes: { title: "Tortas", search: "Buscar torta...", action: "Encomendar", filters: ["Tradicionais", "Premium"] },
  sweets: { title: "Docinhos", search: "Buscar docinho...", action: "Encomendar", filters: ["Brigadeiros", "Caixas"] },
};

function matchesCatalogFilter(product: CommercialProduct, filter: string) {
  const haystack = `${product.name} ${product.short_description} ${product.description}`.toLocaleLowerCase("pt-BR");
  if (["Tradicionais", "Brigadeiros"].includes(filter)) return true;
  if (filter === "Premium") return /premium|especial|gourmet/.test(haystack);
  if (filter === "Caixas") return /caixa|presente/.test(haystack);
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
};

export default function CommercialCatalog({ initialSegment = "cakes" }: { initialSegment?: CommercialSegment }) {
  const orderWhatsAppNumber = useOrderWhatsAppNumber();
  const [products, setProducts] = useState<CommercialProduct[]>([]);
  const [viewedImage, setViewedImage] = useState<ProductImage | null>(null);
  const [segmentMedia, setSegmentMedia] = useState<SegmentMedia[]>([]);
  const [galleryMedia, setGalleryMedia] = useState<CommercialMediaItem[]>([]);
  const [sizeGalleryOpen, setSizeGalleryOpen] = useState(false);
  const [segment, setSegment] = useState<CommercialSegment>(initialSegment);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [catalogReload, setCatalogReload] = useState(0);

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
        setProducts(((productResult.data || []) as CommercialProduct[]).filter((product) => product.segment === "cakes" || product.segment === "sweets").map((product) => ({
          ...product,
          options: options.filter((option) => option.product_id === product.id),
        })));
        if (!mediaResult.error) setSegmentMedia((mediaResult.data || []) as SegmentMedia[]);
        if (!galleryResult.error) setGalleryMedia((galleryResult.data || []) as CommercialMediaItem[]);
      }
      setLoading(false);
    })();
  }, [catalogReload]);

  useEffect(() => {
    setSegment(initialSegment);
    setViewedImage(null);
    setSizeGalleryOpen(false);
  }, [initialSegment]);

  const visibleProducts = useMemo(
    () => products.filter((product) => product.segment === segment),
    [products, segment],
  );
  const displayedProducts = visibleProducts;
  const activeMedia = segmentMedia.find((item) => item.segment === segment) || segmentFallbackMedia[segment];
  const activeExperience = experienceCopy[segment];
  const activeGallery = galleryMedia.filter((item) => item.segment === segment);
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
  const contactAbout = (product: CommercialProduct) => {
    trackPublicEvent("product_view", { product_id: product.id, product_slug: product.slug, segment: product.segment });
    trackPublicEvent("whatsapp_click", { product_id: product.id, product_slug: product.slug, segment: product.segment });
  };
  const whatsappUrlFor = (product: CommercialProduct) => orderWhatsAppUrl(orderWhatsAppNumber, commercialWhatsAppMessage(product));

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
                    <a className="commercial-whatsapp-cta" href={whatsappUrlFor(product)} target="_blank" rel="noreferrer" onClick={() => contactAbout(product)}><MessageCircle aria-hidden="true" /> {presentation.action}</a>
                  </div>
                </article>
              );
            })}
          </div>
        ) : <p>Nenhum produto publicado nesta categoria.</p>}
      </section>

      <section className={`commercial-legacy-section commercial-hero segment-${segment}${segment === "sweets" ? " without-media" : ""}`}>
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
            <a key={product.id} href={whatsappUrlFor(product)} target="_blank" rel="noreferrer" onClick={() => contactAbout(product)}>
              <span>
                <strong>{product.name}</strong>
              </span>
              <b>{commercialProductPriceLabel(product)}</b>
            </a>
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
        <div className="commercial-section-title">
          <span>Catálogo Adoce</span>
          <h2>
{segmentLabels[segment]}
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
"Produto real Adoce"
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
;
              const showProductMedia = showProductGallery
                || (!categoryOnlyMediaSegments.has(segment) && Boolean(productImage));
              return (
              <article className={showProductMedia ? "with-image" : ""} key={product.id}>
                {showProductMedia ? <CommercialMediaCarousel items={itemGallery} fallbackImage={productImage} fallbackAlt={product.name} label={product.name} /> : null}
                <div className="commercial-product-main">
                  <span>
{segmentLabels[product.segment]}
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
                <a className="commercial-whatsapp-cta" href={whatsappUrlFor(product)} target="_blank" rel="noreferrer" onClick={() => contactAbout(product)}>
                  Quero esta opção <ArrowRight />
                </a>
              </article>
            )})}
          </div>
        ) : (
          <p>Nenhuma opção publicada nesta categoria.</p>
        )}
      </section>

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
