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
import { FaFacebookF, FaInstagram } from "react-icons/fa";
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
    title: "Pede Junto Adoce",
    text: "Cada pessoa escolhe e paga a sua. Com cinco fatias no mesmo endereço, a entrega é grátis — e o grupo pode continuar crescendo.",
    href: "/#pede-junto",
    action: "Abrir meu Pede Junto",
    icon: Users,
    image: "/site/pede-junto-pacotes.webp",
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
            <p className="public-kicker">Confeitaria artesanal de verdade · Fortaleza</p>
            <h1>Feito pelas mãos da Beth.<br /><em>Escolhido para adoçar o seu momento.</em></h1>
            <p className="brand-hero-lead">
              Da fatia que transforma uma pausa às celebrações que ficam na memória: aqui você encontra sabor, cuidado e informação honesta para escolher com tranquilidade.
            </p>
            <div className="public-actions">
              <a className="public-primary" href="/#adoce-hoje">Quero uma fatia hoje <ArrowRight /></a>
              <a className="public-secondary on-dark" href="/#encomendas">Quero celebrar</a>
            </div>
            <div className="home-proof-strip" aria-label="Compromissos da Adoce">
              <span><Sparkles /> Produção artesanal</span>
              <span><CakeSlice /> Fotos e condições reais</span>
              <span><Heart /> Atendimento próximo</span>
            </div>
          </div>
          <div className="brand-hero-cake" aria-hidden="true">
            <Heart />
            <img src="/site/hero-slice-real.webp" alt="" />
          </div>
        </div>
      </section>

      <section className="intent-split" aria-labelledby="intent-title">
        <div className="intent-split-head">
          <p className="public-kicker">Seu momento começa aqui</p>
          <h2 id="intent-title">O que trouxe você até a Adoce hoje?</h2>
          <p>Escolha o caminho mais parecido com a sua vontade. A gente mostra somente o que ajuda você a decidir.</p>
        </div>
        <div className="intent-split-grid">
          <a className="intent-card intent-card-now" href="/#adoce-hoje">
            <img src="/adoce-hoje/chocolatudo.webp" alt="Fatia artesanal de torta Adoce" />
            <span className="public-kicker">Para agora</span>
            <h3>Quero uma doçura para hoje.</h3>
            <p>Veja os sabores disponíveis, retirada e horário da barraquinha antes de sair de casa.</p>
            <strong>Descobrir os sabores <ArrowRight /></strong>
          </a>
          <a className="intent-card intent-card-celebrate" href="/#encomendas">
            <img src="/adoce-hoje/festas-eventos.webp" alt="Celebração preparada com doces da Adoce" loading="lazy" />
            <span className="public-kicker">Para celebrar</span>
            <h3>Estou planejando algo especial.</h3>
            <p>Tortas, docinhos, escola, eventos e decoração reunidos para você escolher sem adivinhar.</p>
            <strong>Planejar meu momento <ArrowRight /></strong>
          </a>
        </div>
      </section>

      <section className="path-finder" aria-labelledby="path-title">
        <div className="path-finder-head">
          <div>
            <p className="public-kicker">Comece por aqui</p>
            <h2 id="path-title">Há um jeito Adoce para cada ocasião.</h2>
          </div>
          <p>Conheça cada experiência com fotografias, valores, condições e próximos passos claros. Sem promessas vagas e sem surpresas.</p>
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
          <h2>O cuidado da Beth virou receita. E a receita virou Adoce.</h2>
        </div>
        <figure className="brand-story-photo">
          <img src="/site/beth-fundadora.png" alt="Elizabeth, a Beth, segurando uma torta artesanal feita por ela" loading="lazy" />
          <figcaption><strong>Elizabeth “Beth”</strong><span>Fundadora e confeiteira da Adoce</span></figcaption>
        </figure>
        <div>
          <p>Depois de mais de dez anos como professora de Ciências, Beth precisou se dedicar integralmente ao cuidado do filho Samuel. Em 2023, a confeitaria entrou nessa história como um novo começo — e revelou um talento que hoje adoça a vida de muitas famílias.</p>
          <p>Ela cria e produz; Rubens cuida do atendimento e da organização. Da cozinha de casa à barraquinha de rua, cada torta, docinho e experiência passa pelas mãos de quem constrói a Adoce todos os dias.</p>
          <p className="brand-story-promise"><Heart /> Aqui, artesanal não é uma palavra bonita: é a forma como tudo realmente é feito.</p>
          <div className="story-links">
            <a href="https://www.instagram.com/_adocebrigaderia_/" target="_blank" rel="noreferrer" aria-label="Abrir Instagram da Adoce" title="Instagram"><FaInstagram /></a>
            <a href="https://www.facebook.com/adocebrigaderia" target="_blank" rel="noreferrer" aria-label="Abrir Facebook da Adoce" title="Facebook"><FaFacebookF /></a>
            <a href="https://maps.app.goo.gl/PWLL5zE9fqVpmunj8" target="_blank" rel="noreferrer"><MapPin /> Como chegar</a>
          </div>
        </div>
      </section>

      <section className="signature-experiences" aria-labelledby="signature-title">
        <div className="signature-experiences-head">
          <p className="public-kicker">Dois jeitos de adoçar ainda mais</p>
          <h2 id="signature-title">Uma fatia pode reunir pessoas e ainda render recompensa.</h2>
        </div>
        <div className="signature-grid">
          <article className="signature-card signature-group">
            <div className="signature-copy">
              <Users />
              <p className="public-kicker">Pede Junto Adoce</p>
              <h3>Cada pessoa escolhe e paga a sua.</h3>
              <p>Com cinco fatias para o mesmo endereço, a entrega é grátis. O grupo pode continuar crescendo: quanto mais gente participa, mais doce fica.</p>
              <a href="/#pede-junto">Abrir um Pede Junto <ArrowRight /></a>
            </div>
            <img src="/site/pede-junto-pacotes.webp" alt="Pedidos individuais reunidos no Pede Junto Adoce" loading="lazy" />
          </article>
          <article className="signature-card signature-club">
            <div className="signature-copy">
              <Heart />
              <p className="public-kicker">Clube Adoce</p>
              <h3>Cada fatia vira um carinho de volta.</h3>
              <p>Você recebe um carimbo por fatia tradicional ou premium. Ao completar 14, ganha uma fatia para comemorar do seu jeito.</p>
              <a href="/#clube">Conhecer o Clube Adoce <ArrowRight /></a>
            </div>
            <img src="/site/clube-cartao-destaque-v2.webp" alt="Cartão digital do Clube Adoce com os carimbos conquistados" loading="lazy" />
          </article>
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
          <a href="/#pede-junto">Quero abrir um Pede Junto <ArrowRight /></a>
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
        <div><a href="/#fale-com-a-adoce">Reclamações e sugestões</a><a href="/#politica-de-pedidos">Política de pedidos</a><a href="/#termos">Termos</a><a href="/#privacidade">Privacidade</a></div>
      </footer>
    </main>
  );
}
