import { CalendarDays, CakeSlice, Gift, Heart, PartyPopper, Smartphone, Sparkles } from "lucide-react";
import "./launch-campaign.css";

type LaunchFormat = "feed" | "story" | "facebook" | "carousel";

const slides = [
  {
    eyebrow: "Site oficial Adoce Brigaderia",
    title: <>A doçura ganhou um <em>novo endereço.</em></>,
    text: "Clube Adoce, Festival de Fatias, encomendas e eventos — tudo em um só lugar.",
    icon: Sparkles,
  },
  {
    eyebrow: "Clube Adoce",
    title: <>A tradição continua. Agora, <em>no digital.</em></>,
    text: "A cada fatia, você ganha 1 carimbo. Complete 14 e ganhe uma fatia grátis.",
    icon: Gift,
  },
  {
    eyebrow: "Festival de Fatias",
    title: <>O sabor do dia, <em>na palma da mão.</em></>,
    text: "Veja sabores, horários e disponibilidade antes de sair de casa.",
    icon: CakeSlice,
  },
  {
    eyebrow: "Encomendas & eventos",
    title: <>Seu momento já pode entrar <em>na nossa agenda.</em></>,
    text: "Tortas, docinhos, Adoce na Escola, festas e decoração para celebrar.",
    icon: CalendarDays,
  },
  {
    eyebrow: "Já está no ar",
    title: <>Entre, descubra e <em>adoce o seu dia.</em></>,
    text: "Visite adocebrigaderia.com.br e conheça a nova experiência Adoce.",
    icon: Heart,
  },
];

export default function LaunchCampaign({ format, slide = 1 }: { format: LaunchFormat; slide?: number }) {
  const current = slides[Math.min(Math.max(slide, 1), slides.length) - 1];
  const Icon = format === "feed" || format === "story" || format === "facebook" ? PartyPopper : current.icon;
  const headline = format === "carousel" ? current.title : <>Nosso site oficial <em>está no ar.</em></>;
  const description = format === "carousel"
    ? current.text
    : "Clube Adoce, Festival de Fatias, encomendas e eventos — tudo em um só lugar.";

  return (
    <main className={`launch-art launch-${format} launch-slide-${slide}`}>
      <div className="launch-texture" />
      <header>
        <img src="/site/logo.webp" alt="Adoce Brigaderia" />
        <span><strong>Adoce Brigaderia</strong><small>Feito com carinho</small></span>
        {format === "carousel" ? <b>{slide}/5</b> : null}
      </header>
      <section>
        <div className="launch-copy">
          <p>{format === "carousel" ? current.eyebrow : "Uma nova experiência Adoce"}</p>
          <Icon />
          <h1>{headline}</h1>
          <h2>{description}</h2>
          {format !== "carousel" ? <div className="launch-pills"><span>Clube digital</span><span>Fatias do dia</span><span>Encomendas</span><span>Eventos</span></div> : null}
        </div>
        <div className="launch-cake"><img src="/site/hero-cake.webp" alt="" /><Heart /></div>
      </section>
      <footer>
        <Smartphone />
        <span><strong>adocebrigaderia.com.br</strong><small>Conheça. Peça. Compartilhe doçura.</small></span>
        {format === "carousel" && slide < 5 ? <b>Deslize →</b> : null}
      </footer>
    </main>
  );
}
