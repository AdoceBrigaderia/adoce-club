import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Play, X } from "lucide-react";
import { instagramEmbedUrl, mediaPoster, type CommercialMediaItem } from "./commercial-media";
import ProductImageViewer, { type ProductImage } from "./ProductImageViewer";
import "./commercial-media-carousel.css";

export default function CommercialMediaCarousel({
  items,
  fallbackImage,
  fallbackAlt,
  label,
}: {
  items: CommercialMediaItem[];
  fallbackImage?: string | null;
  fallbackAlt: string;
  label: string;
}) {
  const slides = items.length ? items : fallbackImage ? [{
    id: `fallback-${label}`,
    media_type: "image" as const,
    image_url: fallbackImage,
    external_url: null,
    alt_text: fallbackAlt,
    caption: "",
  }] : [];
  const [index, setIndex] = useState(0);
  const [openedReel, setOpenedReel] = useState<string | null>(null);
  const [viewedImage, setViewedImage] = useState<ProductImage | null>(null);
  const [touchX, setTouchX] = useState<number | null>(null);
  const itemKey = items.map((item) => item.id).join("|");
  useEffect(() => setIndex(0), [label, itemKey]);
  if (!slides.length) return null;
  const current = slides[Math.min(index, slides.length - 1)];
  const poster = mediaPoster(current as CommercialMediaItem, fallbackImage);
  const viewerImages = slides
    .map((slide) => ({ src: mediaPoster(slide as CommercialMediaItem, fallbackImage), alt: slide.alt_text || fallbackAlt }))
    .filter((item): item is ProductImage => Boolean(item.src));
  const previous = () => setIndex((value) => (value - 1 + slides.length) % slides.length);
  const next = () => setIndex((value) => (value + 1) % slides.length);

  return (
    <figure
      className="commercial-media-carousel"
      aria-label={`Galeria de ${label}`}
      onTouchStart={(event) => setTouchX(event.touches[0]?.clientX ?? null)}
      onTouchEnd={(event) => {
        if (touchX === null) return;
        const movement = (event.changedTouches[0]?.clientX ?? touchX) - touchX;
        if (movement > 45) previous();
        if (movement < -45) next();
        setTouchX(null);
      }}
    >
      <div className="commercial-media-stage">
        {poster ? <button className="commercial-media-image product-image-trigger" type="button" onClick={() => setViewedImage({ src: poster, alt: current.alt_text || fallbackAlt })} aria-label={`Ampliar foto de ${label}`}><img src={poster} alt={current.alt_text || fallbackAlt} loading="lazy" /></button> : <div className="commercial-media-reel-placeholder"><Play /></div>}
        {current.media_type === "instagram" && current.external_url ? (
          <button className="commercial-media-play" type="button" onClick={() => setOpenedReel(current.external_url)}>
            <Play /> Assistir ao Reel
          </button>
        ) : null}
        {slides.length > 1 ? <>
          <button className="commercial-media-arrow previous" type="button" onClick={previous} aria-label="Foto anterior"><ChevronLeft /></button>
          <button className="commercial-media-arrow next" type="button" onClick={next} aria-label="Próxima foto"><ChevronRight /></button>
        </> : null}
      </div>
      <figcaption>
        {current.caption ? <span>{current.caption}</span> : current.media_type === "instagram" ? <span>Vídeo no Instagram</span> : null}
        {slides.length > 1 ? <div aria-label="Escolher mídia">{slides.map((slide, slideIndex) => <button key={slide.id} type="button" className={slideIndex === index ? "active" : ""} onClick={() => setIndex(slideIndex)} aria-label={`Ver mídia ${slideIndex + 1}`} />)}</div> : null}
      </figcaption>
      {openedReel ? <div className="commercial-reel-modal" role="dialog" aria-modal="true" aria-label="Reel da Adoce">
        <div>
          <button type="button" onClick={() => setOpenedReel(null)} aria-label="Fechar vídeo"><X /></button>
          {instagramEmbedUrl(openedReel) ? <iframe src={instagramEmbedUrl(openedReel)!} title="Reel da Adoce no Instagram" loading="lazy" allow="autoplay; encrypted-media; picture-in-picture" /> : null}
          <a href={openedReel} target="_blank" rel="noreferrer">Abrir no Instagram <ExternalLink /></a>
        </div>
      </div> : null}
      <ProductImageViewer image={viewedImage} images={viewerImages} onClose={() => setViewedImage(null)} />
    </figure>
  );
}
