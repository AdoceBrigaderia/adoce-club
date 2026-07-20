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
import "./public-commercial-polish.css";

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
    text: "Tabuleiro de Doces e experiências conduzidas pela Adoce para servir e encantar.",
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
    image: "/site/compra-em-grupo-real.jpeg",
    className: "group",
  },
  {
    title: "Clube Adoce",
    text: "Cartão digital, QR, carimbos, fatia grátis e doçura compartilhada.",
    href: "/#clube",
    action: "Ver o Clube por dentro",
    icon: Heart,
    image: "/site/clube-aprovado-mobile-claro.png",
    className: "club",
  },
  {
    title: "Aluguel de decoração",
    text: "Painéis, cilindros, boleiras e kits para montar uma comemoração bonita do seu jeito.",
    href: "/#aluguel-decoracao",
    action: "Conhecer as opções",
    icon: Gift,
    image: "/adoce-hoje/festas-eventos.webp",
    className: "rentals",
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
        <div className="festival-photo today-page-preview">
          <div className="today-page-preview-stage">
            <span className="today-page-preview-label">Imagem ilustrativa</span>
            <figure className="today-page-preview-desktop">
              <div className="today-page-preview-bar">
                <span />
                <strong>adocebrigaderia.com.br/#adoce-hoje</strong>
                <small>Captura real da página</small>
              </div>
              <img src="/site/adoce-hoje-exemplo-desktop.png" alt="Exemplo real da página Adoce Hoje no computador" />
            </figure>
            <figure className="today-page-preview-mobile">
              <span aria-hidden="true" />
              <img src="/site/adoce-hoje-exemplo-mobile.png" alt="Exemplo real da página Adoce Hoje no celular" />
            </figure>
            <p>Prévia ilustrativa da página. Sabores, fotos, valores, horários e disponibilidade mudam ao longo do dia.</p>
          </div>
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
          <p>Cada torta, docinho e experiência passa pelas mãos de quem produz e atende. Nossa fábrica fica no Passaré, em Fortaleza, e o cuidado aparece no sabor, na apresentação e na forma de receber cada pessoa.</p>
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
          <a href="/#aluguel-decoracao">Quero alugar uma decoração <ArrowRight /></a>
          <a href="/#compra-em-grupo">Quero organizar uma compra em grupo <ArrowRight /></a>
          <a href="/#clube">Quero conhecer o Clube <ArrowRight /></a>
        </div>
      </section>

      <section className="order-policy-callout">
        <CalendarDays />
        <div>
          <p className="public-kicker">Planeje com tranquilidade</p>
          <h2>Confira nossa política de pedidos antes de encomendar.</h2>
          <p>Os produtos aceitos mudam conforme o dia da semana para respeitar o tempo da nossa produção artesanal.</p>
        </div>
        <a href="/#politica-de-pedidos">Ver política de pedidos <ArrowRight /></a>
      </section>

      <footer className="public-footer">
        <a className="public-brand" href="/#inicio"><img src="/site/logo.webp" alt="" /><strong>Adoce Brigaderia</strong></a>
        <p>© 2026 Adoce Brigaderia · Fortaleza, Ceará</p>
        <div><a href="/#politica-de-pedidos">Política de pedidos</a><a href="/#termos">Termos</a><a href="/#privacidade">Privacidade</a></div>
      </footer>
    </main>
  );
}
