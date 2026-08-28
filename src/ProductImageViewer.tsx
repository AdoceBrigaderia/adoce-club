import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";
import "./product-image-viewer.css";

export type ProductImage = { src: string; alt: string };

export default function ProductImageViewer({
  image,
  images,
  onClose,
}: {
  image: ProductImage | null;
  images?: ProductImage[];
  onClose: () => void;
}) {
  const slides = useMemo(() => {
    const source = images?.length ? images : image ? [image] : [];
    return source.filter((item, index, all) => item.src && all.findIndex((candidate) => candidate.src === item.src) === index);
  }, [image, images]);
  const initialIndex = Math.max(0, image ? slides.findIndex((item) => item.src === image.src) : 0);
  const [index, setIndex] = useState(initialIndex);
  const [touchX, setTouchX] = useState<number | null>(null);
  const current = slides[Math.min(index, Math.max(slides.length - 1, 0))] || image;
  const hasCarousel = slides.length > 1;
  const previous = () => setIndex((value) => (value - 1 + slides.length) % slides.length);
  const next = () => setIndex((value) => (value + 1) % slides.length);

  useEffect(() => setIndex(initialIndex), [image?.src, initialIndex]);
  useEffect(() => {
    if (!image) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (hasCarousel && event.key === "ArrowLeft") previous();
      if (hasCarousel && event.key === "ArrowRight") next();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [hasCarousel, image, onClose, slides.length]);
  if (!image || !current) return null;
  return <div
    className="product-image-viewer"
    role="dialog"
    aria-modal="true"
    aria-label={current.alt}
    onClick={onClose}
    onTouchStart={(event) => setTouchX(event.touches[0]?.clientX ?? null)}
    onTouchEnd={(event) => {
      if (touchX === null || !hasCarousel) return;
      const movement = (event.changedTouches[0]?.clientX ?? touchX) - touchX;
      if (movement > 45) previous();
      if (movement < -45) next();
      setTouchX(null);
    }}
  >
    <button type="button" onClick={onClose} aria-label="Fechar imagem"><X /></button>
    {hasCarousel ? <button className="product-image-viewer-arrow previous" type="button" onClick={(event) => { event.stopPropagation(); previous(); }} aria-label="Imagem anterior"><ChevronLeft /></button> : null}
    <figure onClick={(event) => event.stopPropagation()}>
      <img src={current.src} alt={current.alt} />
      <figcaption><ZoomIn /> Imagem {index + 1} de {slides.length}, completa e sem cortes</figcaption>
    </figure>
    {hasCarousel ? <button className="product-image-viewer-arrow next" type="button" onClick={(event) => { event.stopPropagation(); next(); }} aria-label="Próxima imagem"><ChevronRight /></button> : null}
  </div>;
}
