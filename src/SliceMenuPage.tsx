import { Camera, Clock3, Heart, MessageCircle, ShoppingBag, Star, Store } from "lucide-react";
import { useState } from "react";
import PublicCatalogNav from "./PublicCatalogNav";
import ProductImageViewer, { type ProductImage } from "./ProductImageViewer";
import "./slice-menu-page.css";

type MenuDay = { day: string; daily: string; image: string };

const menuDays: MenuDay[] = [
  { day: "Terça-feira", daily: "Trufado de Ninho", image: "/adoce-hoje/trufado-ninho-morango.webp" },
  { day: "Quarta-feira", daily: "Black Velvet", image: "/adoce-hoje/trufado-black-ilustrativa.webp" },
  { day: "Quinta-feira", daily: "Chocolatudo", image: "/adoce-hoje/chocolatudo.webp" },
  { day: "Sexta-feira", daily: "Red Velvet com Ninho e Nutella", image: "/adoce-hoje/red-velvet.webp" },
  { day: "Sábado", daily: "Trufado de Ninho", image: "/adoce-hoje/trufado-ninho-morango.webp" },
];

export default function SliceMenuPage() {
  const [viewedImage, setViewedImage] = useState<ProductImage | null>(null);
  const viewerImages = [
    { src: "/site/portal-entry-fatias.png", alt: "Fatia real da Adoce pronta para retirada" },
    ...menuDays.map((item) => ({ src: item.image, alt: `Fatia ${item.daily}` })),
  ];
  return <main className="slice-menu-page">
    <section className="slice-menu-hero">
      <div><p>Catálogo Adoce</p><h1>Cardápio de <em>fatias</em></h1><span>Escolha pelo dia da semana e consulte a disponibilidade antes de finalizar.</span></div>
      <button className="product-image-trigger" type="button" onClick={() => setViewedImage({ src: "/site/portal-entry-fatias.png", alt: "Fatia real da Adoce pronta para retirada" })}><img src="/site/portal-entry-fatias.png" alt="Fatia real da Adoce pronta para retirada" /></button>
    </section>
    <section className="slice-menu-shell">
      <PublicCatalogNav active="slices" />
      <div className="slice-menu-facts" aria-label="Informações do cardápio">
        <article><ShoppingBag /><div><strong>Apenas pedidos on-line</strong><span>Terça a sábado · 9h às 16h</span></div></article>
        <article><Store /><div><strong>Cantinho Adoce</strong><span>Venha escolher sua fatia ou peça on-line · Terça a sábado · 17h às 22h</span></div></article>
        <article><Heart /><div><strong>Valores das fatias</strong><span>Tradicionais R$ 16 · Premium R$ 20</span></div></article>
      </div>
      <div className="slice-menu-heading"><div><p>Sabores do dia</p><h2>Um destaque para cada dia</h2></div><span>Consulte a produção e faça sua reserva com antecedência.</span></div>
      <div className="slice-daily-grid">{menuDays.map(item => <article key={item.day}><button className="product-image-trigger" type="button" onClick={() => setViewedImage({ src: item.image, alt: `Fatia ${item.daily}` })}><img src={item.image} alt={`Fatia ${item.daily}`} /></button><div><span>{item.day}</span><strong>{item.daily}</strong><small><Star /> Sabor do dia</small></div></article>)}</div>
      <section className="slice-menu-order">
        <div><p>Como pedir</p><h2>Escolha, consulte e combine sua retirada.</h2></div>
        <ol><li><span>1</span>Escolha o sabor e o dia.</li><li><span>2</span>Monte o pedido pelo site.</li><li><span>3</span>Confirme a disponibilidade e a retirada.</li></ol>
        <div className="slice-menu-channels"><a href="/#adoce-hoje"><ShoppingBag /> Montar pedido</a><span><Camera /> Instagram</span><span><MessageCircle /> App 99</span></div>
        <p className="slice-menu-note"><Clock3 /> Pedidos on-line: terça a sábado, das 9h às 16h.</p>
      </section>
      <ProductImageViewer image={viewedImage} images={viewerImages} onClose={() => setViewedImage(null)} />
    </section>
  </main>;
}
