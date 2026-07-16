import { useMemo, useState } from "react";
import { Clock3, Heart, MapPin, MessageCircle, ShoppingBag, Sparkles } from "lucide-react";
import "./adoce-hoje.css";

type Availability = "all" | "now" | "night";

type Flavor = {
  name: string;
  note: string;
  price: number;
  image: string;
  now: boolean;
  night: boolean;
  premium?: boolean;
};

const flavors: Flavor[] = [
  { name: "Kinder Bueno", note: "Cremoso, marcante e irresistível", price: 20, image: "/adoce-hoje/kinder-bueno.webp", now: true, night: true, premium: true },
  { name: "Trufado de Ninho com morangos", note: "Chocolate trufado com morangos", price: 16, image: "/adoce-hoje/chocolatudo-morangos.webp", now: true, night: true },
  { name: "Red Velvet com Ninho e Nutella", note: "Cremosa, fofinha e irresistível", price: 16, image: "/adoce-hoje/red-velvet.webp", now: true, night: true },
  { name: "Chocolatudo", note: "Massa molhadinha e recheio cremoso", price: 16, image: "/adoce-hoje/chocolatudo.webp", now: false, night: true },
  { name: "Ferrero Rocher", note: "Chocolate, creme e crocância", price: 16, image: "/adoce-hoje/ferrero-rocher.webp", now: false, night: true },
  { name: "Chocolatudo trufado", note: "Chocolate intenso com recheio cremoso", price: 16, image: "/adoce-hoje/chocolatudo.webp", now: false, night: true },
  { name: "Oreo", note: "Chocolate com recheio cremoso", price: 16, image: "/adoce-hoje/oreo.webp", now: false, night: true },
  { name: "Limão com frutas vermelhas", note: "Levinha, cremosa e irresistível", price: 16, image: "/adoce-hoje/limao-frutas-vermelhas.webp", now: true, night: true },
  { name: "Abacaxi com coco", note: "Cremoso, molhadinho e com pedaços de abacaxi", price: 16, image: "/adoce-hoje/abacaxi-coco.webp", now: false, night: true },
  { name: "Chocolate com castanha", note: "Disponível no Festival de Fatias", price: 16, image: "/adoce-hoje/sabores-hoje.webp", now: false, night: true },
];

const whatsapp = "https://wa.me/5585982156026?text=Ol%C3%A1%2C%20Adoce!%20Quero%20pedir%20uma%20fatia%20do%20festival.";
const maps = "https://www.google.com/maps/search/?api=1&query=Festival%20de%20Fatias%20Adoce%20Brigaderia";

function Brand() {
  return <a className="today-brand" href="#adoce-hoje" aria-label="Adoce Hoje"><img src="/site/logo.webp" alt="Adoce Brigaderia"/><span><strong>Clube Adoce</strong><small>Adoce Hoje</small></span></a>;
}

export default function AdoceHoje() {
  const [filter, setFilter] = useState<Availability>("all");
  const visible = useMemo(() => flavors.filter((flavor) => filter === "all" || (filter === "now" ? flavor.now : flavor.night)), [filter]);

  return <main className="today-page">
    <header className="today-header">
      <Brand/>
      <nav aria-label="Atalhos de hoje">
        <a href="#sabores">Sabores</a>
        <a href="#barraquinha">Barraquinha</a>
        <a className="today-order-small" href={whatsapp} target="_blank" rel="noreferrer"><MessageCircle/> Pedir</a>
      </nav>
    </header>

    <section className="today-hero">
      <div className="today-hero-copy">
        <div className="today-live"><span/> Hoje tem Festival de Fatias</div>
        <p className="today-kicker">Quinta-feira · 16 de julho</p>
        <h1>Seu sabor favorito está <em>te esperando.</em></h1>
        <p className="today-lead">Fatias a partir de <strong>R$ 16</strong>, retirada antecipada e barraquinha presencial hoje à noite.</p>
        <div className="today-status-grid">
          <div><ShoppingBag/><span><strong>Retirada disponível</strong><small>Sabores selecionados agora</small></span></div>
          <div><Clock3/><span><strong>A partir das 19:30</strong><small>Atendimento na barraquinha</small></span></div>
        </div>
        <div className="today-hero-actions">
          <a className="today-primary" href={whatsapp} target="_blank" rel="noreferrer"><MessageCircle/> Pedir pelo WhatsApp</a>
          <a className="today-secondary" href={maps} target="_blank" rel="noreferrer"><MapPin/> Como chegar</a>
        </div>
      </div>
      <figure className="today-poster"><img src="/adoce-hoje/sabores-hoje.webp" alt="Banner com os sabores do Festival de Fatias Adoce"/><figcaption>Cardápio preparado para hoje</figcaption></figure>
    </section>

    <section className="today-flavors" id="sabores">
      <div className="today-section-head"><div><p className="today-kicker">Adoce Hoje</p><h2>Escolha sua felicidade</h2></div><p>Os sabores marcados como “agora” já podem ser pedidos para retirada. Todos estarão na barraquinha à noite.</p></div>
      <div className="today-filters" role="group" aria-label="Filtrar sabores">
        <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Todos <span>{flavors.length}</span></button>
        <button className={filter === "now" ? "active" : ""} onClick={() => setFilter("now")}>Disponíveis agora <span>{flavors.filter(f => f.now).length}</span></button>
        <button className={filter === "night" ? "active" : ""} onClick={() => setFilter("night")}>Na barraquinha <span>{flavors.filter(f => f.night).length}</span></button>
      </div>
      <div className="today-card-grid">
        {visible.map((flavor) => <article className="today-flavor-card" key={flavor.name}>
          <div className="today-card-image"><img src={flavor.image} alt={`Fatia ${flavor.name}`} loading="lazy"/>{flavor.premium && <span className="today-premium"><Sparkles/> Premium</span>}</div>
          <div className="today-card-body"><div><div className="today-card-status">{flavor.now ? <><span className="now"/> Disponível agora</> : <><Clock3/> À noite, 19:30</>}</div><h3>{flavor.name}</h3><p>{flavor.note}</p></div><div className="today-price"><small>fatia</small><strong>R$ {flavor.price}</strong></div></div>
          <a href={`${whatsapp}%20Sabor%3A%20${encodeURIComponent(flavor.name)}`} target="_blank" rel="noreferrer"><MessageCircle/> Quero esta</a>
        </article>)}
      </div>
    </section>

    <section className="today-event" id="barraquinha">
      <div className="today-event-copy"><p className="today-kicker">Hoje tem encontro</p><h2>A barraquinha abre às <em>19:30.</em></h2><p>Para chegar, pesquise por <strong>“Festival de Fatias Adoce Brigaderia”</strong> no Waze, Google Maps, Uber ou 99.</p><a className="today-primary" href={maps} target="_blank" rel="noreferrer"><MapPin/> Abrir localização</a></div>
      <div className="today-contact"><Heart/><h3>Pedidos antecipados</h3><a href={whatsapp} target="_blank" rel="noreferrer">85 98215-6026</a><a href="https://wa.me/5585981994370" target="_blank" rel="noreferrer">85 98199-4370</a><small>Escolha o sabor e confirme a disponibilidade pelo WhatsApp.</small></div>
    </section>

    <footer className="today-footer"><Brand/><p>Aqui na Adoce você compra a fatia e a felicidade vai junto.</p></footer>
    <div className="today-mobile-bar"><a href={maps} target="_blank" rel="noreferrer"><MapPin/> Chegar</a><a href={whatsapp} target="_blank" rel="noreferrer"><MessageCircle/> Pedir agora</a></div>
  </main>;
}