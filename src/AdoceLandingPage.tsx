import { CakeSlice, ClipboardList, Clock3, CreditCard, Gift, Heart, MapPin, Menu, MessageCircle, ShoppingBasket, Star, Users } from "lucide-react";
import "./adoce-landing-2026.css";

const asset = "/brand-2026/landing/adoce_assets_site";

const choices = [
  {
    title: "Quero fazer um pedido online",
    description: "Escolha suas fatias, veja os sabores disponíveis e faça seu pedido de forma rápida e segura.",
    href: "/cardapio",
    cta: "Fatias e mais",
    icon: CakeSlice,
    details: [[ShoppingBasket, "Veja o menu disponível"], [CreditCard, "Pedido online pelo site"], [MessageCircle, "Acompanhe pelo WhatsApp"]],
  },
  {
    title: "Quero fazer uma encomenda",
    description: "Solicite seu orçamento para tortas inteiras, kits, docinhos e encomendas especiais.",
    href: "/catalogo",
    cta: "Catálogo de produtos",
    icon: ClipboardList,
    details: [[CakeSlice, "Tortas P, M e G em vários sabores"], [Gift, "Kits e docinhos"], [Users, "Orçamento personalizado"]],
  },
  {
    title: "Quero fazer parte do nosso programa de fidelidade",
    description: "Acumule carimbos, ganhe prêmios e aproveite vantagens exclusivas na Adoce Brigaderia.",
    href: "/clube",
    cta: "Fazer parte do Clube",
    icon: CreditCard,
    details: [[Star, "Acumule carimbos"], [CakeSlice, "Troque por fatia grátis"], [Heart, "Vantagens exclusivas"]],
  },
] as const;

export default function AdoceLandingPage() {
  return (
    <main className="landing-2026">
      <header className="landing-hero">
        <img className="landing-logo" src="/brand-2026/logo-adoce-transparente.png" alt="Adoce Brigaderia" />
        <button className="landing-menu" type="button" aria-label="Abrir menu"><Menu /></button>
        <div className="landing-welcome">
          <h1>Olá, Cliente! <span>♡</span></h1>
          <h2>O que você quer fazer hoje?</h2>
          <p>Escolha uma das opções abaixo para continuar.</p>
        </div>
        <div className="landing-stamp" aria-label="Fatias, tortas e muito mais"><i></i><span>FATIAS,<br />TORTAS<br />E MUITO<br />MAIS!</span><b>♥</b></div>
      </header>

      <section className="landing-choices" aria-label="Escolha como a Adoce pode ajudar hoje">
        {choices.map((choice) => (
          <article className="landing-choice" key={choice.href}>
            <div className="landing-choice-copy">
              <span className="landing-choice-icon" aria-hidden="true"><choice.icon /></span>
              <div><h2>{choice.title}</h2><p>{choice.description}</p></div>
            </div>
            <div className="landing-choice-action">
              <a href={choice.href}>{choice.cta}<span aria-hidden="true">›</span></a>
              <div className="landing-choice-details">
                {choice.details.map(([Icon, label]) => <div key={label}><Icon aria-hidden="true" /><span>{label}</span></div>)}
              </div>
            </div>
          </article>
        ))}
      </section>

      <footer className="landing-footer">
        <img src="/brand-2026/logo-adoce-transparente.png" alt="Adoce Brigaderia" />
        <div><MapPin aria-hidden="true" /><p><strong>Nossa localização</strong><br />Av. da Saudade, S/N<br />Em frente à Reserva dos Ipês<br />Divino Espeto — Fortaleza/CE</p></div>
        <div><Clock3 aria-hidden="true" /><p><strong>Funcionamento</strong><br />Terça a sábado<br />das 17h às 23h<br /><small>(ou enquanto durarem os estoques)</small></p></div>
      </footer>
    </main>
  );
}
