import {
  ArrowRight,
  CakeSlice,
  CalendarDays,
  Gift,
  Heart,
  MapPin,
  MessageCircle,
  School,
  Sparkles,
  Users,
} from "lucide-react";
import PublicHeader from "./PublicHeader";
import "./public-site.css";

const paths = [
  {
    title: "Festival de Fatias",
    text: "Veja sabores, fotos, disponibilidade e horários antes de sair de casa.",
    href: "/#adoce-hoje",
    action: "Ver as fatias de hoje",
    icon: CakeSlice,
    image: "/adoce-hoje/chocolatudo.webp",
    className: "today",
  },
  {
    title: "Tortas e docinhos",
    text: "Monte sua encomenda com tamanhos, recheios, adicionais e valores atualizados.",
    href: "/#encomendas",
    action: "Conhecer encomendas",
    icon: Gift,
    image: "/adoce-hoje/docinhos-tradicionais.webp",
    className: "orders",
  },
  {
    title: "Festas e eventos",
    text: "Tabuleiro de Doces, Festa na Mesa, kits, acervo e experiências para celebrar.",
    href: "/#eventos",
    action: "Planejar uma celebração",
    icon: Sparkles,
    image: "/adoce-hoje/festas-eventos.webp",
    className: "events",
  },
  {
    title: "Adoce na Escola",
    text: "Pacotes pensados para comemorar na escola com organização e antecedência.",
    href: "/#adoce-na-escola",
    action: "Conhecer os pacotes",
    icon: School,
    image: "/adoce-hoje/adoce-na-escola.webp",
    className: "school",
  },
  {
    title: "Compra em Grupo",
    text: "Junte cinco fatias ou mais para o mesmo endereço e organize tudo pelo WhatsApp.",
    href: "/#compra-em-grupo",
    action: "Organizar meu grupo",
    icon: Users,
    image: "/adoce-hoje/brigadeiro-castanha.webp",
    className: "group",
  },
  {
    title: "Clube Adoce",
    text: "Cartão digital, QR, carimbos, fatia grátis e doçura compartilhada.",
    href: "/#clube",
    action: "Ver o Clube por dentro",
    icon: Heart,
    image: "/site/hero-cake.webp",
    className: "club",
  },
] as const;

export default function MarketingLanding() {
  return (
    <main className="public-site" id="inicio">
      <section className="brand-hero">
        <PublicHeader />
        <div className="brand-hero-inner">
          <div className="brand-hero-copy">
            <p className="public-kicker">Adoce Brigaderia · Fortaleza</p>
            <h1>Doçura para hoje.<br /><em>E para celebrar.</em></h1>
            <p className="brand-hero-lead">
              Fatias artesanais, tortas, docinhos e experiências que acompanham desde uma vontade de agora até os momentos que ficam para sempre.
            </p>
            <div className="public-actions">
              <a className="public-primary" href="/#adoce-hoje">Ver fatias de hoje <ArrowRight /></a>
              <a className="public-secondary on-dark" href="/#eventos">Planejar uma comemoração</a>
            </div>
          </div>
          <div className="brand-hero-cake" aria-hidden="true">
            <Heart />
            <img src="/site/hero-cake.webp" alt="" />
          </div>
        </div>
      </section>

      <section className="path-finder" aria-labelledby="path-title">
        <div className="path-finder-head">
          <div>
            <p className="public-kicker">Comece por aqui</p>
            <h2 id="path-title">O que você procura hoje?</h2>
          </div>
          <p>Cada experiência da Adoce tem seu próprio espaço, com informações e próximos passos específicos.</p>
        </div>
        <div className="path-list">
          {paths.map(({ title, text, href, action, icon: Icon, image, className }, index) => (
            <article className={`path-item ${className}`} key={title}>
              <div className="path-number">0{index + 1}</div>
              <div className="path-copy">
                <Icon />
                <h3>{title}</h3>
                <p>{text}</p>
                <a href={href}>{action} <ArrowRight /></a>
              </div>
              <div className="path-image"><img src={image} alt="" /></div>
            </article>
          ))}
        </div>
      </section>

      <section className="festival-feature">
        <div className="festival-photo">
          <img src="/adoce-hoje/sabores-hoje.webp" alt="Seleção de fatias artesanais da Adoce" />
        </div>
        <div className="festival-copy">
          <p className="public-kicker">Festival de Fatias</p>
          <h2>A vontade começa antes da visita.</h2>
          <p>Consulte sabores, fotografias, disponibilidade, retirada e horário da barraquinha em uma experiência feita para decidir rápido.</p>
          <ul>
            <li><CakeSlice /> Sabores e valores atualizados</li>
            <li><CalendarDays /> Funcionamento real do dia</li>
            <li><MessageCircle /> Pedido e contato em poucos toques</li>
          </ul>
          <a className="public-primary" href="/#adoce-hoje">Abrir o Adoce Hoje <ArrowRight /></a>
        </div>
      </section>

      <section className="brand-story">
        <div>
          <p className="public-kicker">Sobre a Adoce</p>
          <h2>Uma história feita de reinvenção, cuidado e coragem.</h2>
        </div>
        <div>
          <p>A Adoce nasceu em 2023, da força de uma mãe atípica que encontrou na confeitaria artesanal uma forma de transformar cuidado em sabor. Rubens e Elizabeth seguem construindo essa história ao lado de cada cliente.</p>
          <p>Nossa fábrica fica no Passaré, em Fortaleza, com produção feita à mão e retiradas em horário combinado.</p>
          <div className="story-links">
            <a href="https://www.instagram.com/_adocebrigaderia_/" target="_blank" rel="noreferrer">Instagram</a>
            <a href="https://www.facebook.com/adocebrigaderia" target="_blank" rel="noreferrer">Facebook</a>
            <a href="https://maps.app.goo.gl/PWLL5zE9fqVpmunj8" target="_blank" rel="noreferrer"><MapPin /> Como chegar</a>
          </div>
        </div>
      </section>

      <section className="final-chooser">
        <p className="public-kicker">Adoce Brigaderia</p>
        <h2>Qual é o próximo momento que vamos adoçar?</h2>
        <div>
          <a href="/#adoce-hoje">Quero uma fatia hoje <ArrowRight /></a>
          <a href="/#encomendas">Quero fazer uma encomenda <ArrowRight /></a>
          <a href="/#eventos">Quero planejar um evento <ArrowRight /></a>
          <a href="/#clube">Quero conhecer o Clube <ArrowRight /></a>
        </div>
      </section>

      <footer className="public-footer">
        <a className="public-brand" href="/#inicio"><img src="/site/logo.webp" alt="" /><strong>Adoce Brigaderia</strong></a>
        <p>© 2026 Adoce Brigaderia · Fortaleza, Ceará</p>
        <div><a href="/#termos">Termos</a><a href="/#privacidade">Privacidade</a></div>
      </footer>
    </main>
  );
}
