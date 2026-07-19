import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CakeSlice,
  ChevronDown,
  Clock3,
  Gift,
  Heart,
  MessageCircle,
  Menu,
  Share2,
  Smartphone,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import "./marketing.css";
import "./marketing-promotions.css";
import GroupOrderArtwork from "./GroupOrderArtwork";

function Brand() {
  return (
    <a className="marketing-brand" href="#inicio">
      <img src="/site/logo.webp" alt="Adoce Brigaderia" />
      <strong>Clube Adoce</strong>
    </a>
  );
}
const features = [
  {
    n: "01",
    title: "Carteira digital",
    text: "A integração com Apple Wallet e Google Wallet é a única parte do Clube que ainda está em desenvolvimento.",
    icon: Smartphone,
    status: "Chegando em breve",
  },
  {
    n: "02",
    title: "Cartão em Grupo",
    text: "Casais, famílias e amigos podem somar carimbos no mesmo Cartão Clube Adoce, cada pessoa com seu acesso.",
    icon: Users,
    status: "Disponível",
  },
  {
    n: "03",
    title: "Espalhe Doçura",
    text: "A indicação confirmada dá um carimbo a quem chegou ao Clube e a quem fez o convite.",
    icon: Share2,
    status: "Disponível",
  },
  {
    n: "04",
    title: "Minha Fatia Grátis",
    text: "A fatia grátis fica guardada. Você continua juntando carimbos no próximo cartão até decidir quando retirar.",
    icon: Gift,
    status: "Disponível",
  },
];

export default function MarketingLanding() {
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(
      (es) =>
        es.forEach(
          (e) => e.isIntersecting && e.target.classList.add("visible"),
        ),
      { threshold: 0.12 },
    );
    document
      .querySelectorAll(".marketing-reveal")
      .forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
  return (
    <main className="marketing-page">
      <section className="marketing-hero" id="inicio">
        <header>
          <Brand />
          <nav className={menu ? "open" : ""}>
            <a href="#experiencia" onClick={() => setMenu(false)}>
              Experiência
            </a>
            <a href="#novidades" onClick={() => setMenu(false)}>
              Novidades
            </a>
            <a href="#previas" onClick={() => setMenu(false)}>
              Veja por dentro
            </a>
            <a href="#adoce-hoje" onClick={() => setMenu(false)}>
              Adoce Hoje
            </a>
            <a href="/#encomendas" onClick={() => setMenu(false)}>
              Encomendas
            </a>
            <a className="marketing-login" href="#entrar">
              Entrar no Clube
            </a>
          </nav>
          <button
            className="marketing-menu"
            onClick={() => setMenu(!menu)}
            aria-label="Abrir menu"
          >
            {menu ? <X /> : <Menu />}
          </button>
        </header>
        <div className="marketing-hero-inner">
          <div className="marketing-hero-copy marketing-reveal visible">
            <span>
              <i /> Uma nova experiência Adoce
            </span>
            <h1>
              Faça parte do <em>Clube Adoce</em>
            </h1>
            <p>
              A cada fatia comprada, você recebe um carimbo. Complete 14
              carimbos e ganhe uma fatia grátis.
            </p>
            <div>
              <a className="marketing-primary" href="#cadastro">
                Quero fazer parte <ArrowRight />
              </a>
              <a className="marketing-text-link" href="#entrar">
                Entrar no Clube
              </a>
            </div>
          </div>
          <div className="marketing-cake" aria-hidden="true">
            <img src="/site/hero-cake.webp" alt="" />
            <Heart />
          </div>
        </div>
        <a className="marketing-scroll" href="#experiencia">
          Role para descobrir <ChevronDown />
        </a>
      </section>
      <section className="marketing-story" id="experiencia">
        <div className="marketing-story-head marketing-reveal">
          <div>
            <span>O Clube Adoce</span>
            <h2>
              Mais que um cartão,
              <br />
              um jeito de <em>estar junto.</em>
            </h2>
          </div>
          <div>
            <p>
              Cada fatia comprada — tradicional ou premium — vale um carimbo. Ao
              completar 14, você ganha uma fatia tradicional ou escolhe uma
              premium pagando somente a diferença.
            </p>
            <p>
              Sua fatia grátis fica guardada até você decidir retirar, enquanto
              um novo Cartão Clube Adoce já começa a receber carimbos.
            </p>
          </div>
        </div>
        <div className="marketing-marquee">
          <div>
            juntos é mais doce <Heart /> fatia grátis no seu tempo <Gift /> sabores
            do dia <CakeSlice /> juntos é mais doce <Heart /> fatia grátis no seu
            tempo <Gift /> sabores do dia <CakeSlice />
          </div>
        </div>
      </section>
      <section className="marketing-progress" id="novidades">
        <div className="marketing-section-head marketing-reveal">
          <div>
            <span>Clube Adoce</span>
            <h2>Recursos do Clube</h2>
          </div>
          <p>
            Entrada no Clube, acesso, carimbos, indicações e resgate já fazem parte da
            experiência. A carteira digital está identificada separadamente.
          </p>
        </div>
        <div className="marketing-feature-list">
          {features.map(({ n, title, text, icon: Icon, status }, i) => (
            <article
              className="marketing-reveal"
              style={{ transitionDelay: `${i * 0.08}s` }}
              key={title}
            >
              <span>{n}</span>
              <Icon />
              <h3>{title}</h3>
              <p>{text}</p>
              <small>{status}</small>
            </article>
          ))}
        </div>
      </section>
      <section className="marketing-preview" id="previas">
        <div className="marketing-section-head light marketing-reveal">
          <div>
            <span>Uma primeira olhada</span>
            <h2>Veja o Clube por dentro</h2>
          </div>
          <p>
            Telas pensadas para serem simples, bonitas e fáceis de usar — mesmo
            durante o atendimento mais movimentado.
          </p>
        </div>
        <div className="marketing-devices">
          <article className="marketing-phone marketing-reveal">
            <div className="phone-top">
              <img src="/site/logo.webp" alt="" />
              <span>Clube Adoce</span>
            </div>
            <p>Área do Membro</p>
            <h3>Olá, Rubens!</h3>
            <div className="preview-loyalty">
              <small>Cartão Clube Adoce · Meus Carimbos</small>
              <strong>
                8 <span>de 14</span>
              </strong>
              <div>
                {Array.from({ length: 14 }, (_, i) => (
                  <i className={i < 8 ? "filled" : ""} key={i}>
                    <Heart />
                  </i>
                ))}
              </div>
            </div>
            <nav>
              <Heart />
              <Sparkles />
              <Users />
            </nav>
          </article>
        </div>
      </section>
      <section className="marketing-group-order marketing-reveal">
        <div>
          <span>Compra em grupo</span>
          <h2>Junte 5 fatias ou mais. A entrega em Fortaleza é grátis.</h2>
          <p>Um único pedido para o mesmo endereço, perfeito para trabalho, condomínio, família ou amigos. Pagamento antecipado por Pix ou link de cartão.</p>
          <a className="marketing-primary" href="https://wa.me/5585982156026?text=Ol%C3%A1%2C%20Adoce!%20Quero%20organizar%20uma%20compra%20em%20grupo." target="_blank" rel="noreferrer">Organizar meu grupo <ArrowRight /></a>
        </div>
        <GroupOrderArtwork />
      </section>
      <section className="marketing-orders" id="encomendas">
        <div className="marketing-reveal">
          <span>Além das fatias</span>
          <h2>Encomendas e eventos com a assinatura Adoce.</h2>
          <p>
            Tortas inteiras, docinhos, Tabuleiro de Doces, Adoce na Escola,
            kits de festa e aluguel de acervo — cada linha em seu lugar, com
            valores e agenda administrados pela nossa equipe.
          </p>
          <a className="marketing-primary" href="/#encomendas">
            Conhecer opções e solicitar data <ArrowRight />
          </a>
        </div>
        <div className="marketing-orders-steps marketing-reveal">
          <p><CakeSlice /><span><strong>Escolha</strong><small>Veja produtos, pacotes e condições.</small></span></p>
          <p><CalendarDays /><span><strong>Solicite a data</strong><small>A agenda verifica conflitos antes do atendimento.</small></span></p>
          <p><MessageCircle /><span><strong>Confirme com a equipe</strong><small>A pré-reserva dura 48 horas e a data é garantida com o sinal.</small></span></p>
        </div>
      </section>
      <section className="marketing-today" id="adoce-hoje">
        <div className="marketing-reveal">
          <span>Adoce Hoje</span>
          <h2>A vontade começa antes da visita.</h2>
          <p>
            Sabores disponíveis, horário de atendimento, status da barraquinha,
            pedidos e promoções — sempre com informação atualizada e honesta.
          </p>
          <a className="marketing-primary" href="/#adoce-hoje">
            Conhecer o Adoce Hoje <ArrowRight />
          </a>
        </div>
        <div className="marketing-today-list marketing-reveal">
          <p>
            <CakeSlice /> Sabores e fotos <small>Já disponível</small>
          </p>
          <p>
            <Clock3 /> Horários e funcionamento{" "}
            <small>Já disponível</small>
          </p>
          <p>
            <Sparkles /> Novidades e promoções <small>Já disponível</small>
          </p>
          <p>
            <Heart /> Clube e fatia grátis <small>Já disponível</small>
          </p>
        </div>
      </section>
      <section className="marketing-about" id="sobre">
        <div className="marketing-reveal">
          <span>Sobre a Adoce</span>
          <h2>Uma história feita de reinvenção, cuidado e coragem.</h2>
        </div>
        <div className="marketing-reveal">
          <p>
            A Adoce nasceu em 2023, da força de uma mãe atípica que encontrou
            na confeitaria artesanal uma forma de transformar cuidado em sabor.
            Rubens e Elizabeth seguem construindo essa história ao lado de cada
            cliente, com produção feita à mão e atenção aos detalhes.
          </p>
          <p>
            Nossa fábrica fica no Passaré, em Fortaleza, e recebe retiradas de
            encomendas e pedidos online com horário combinado.
          </p>
          <div>
            <a href="https://www.instagram.com/_adocebrigaderia_/" target="_blank" rel="noreferrer">Instagram</a>
            <a href="https://www.facebook.com/adocebrigaderia" target="_blank" rel="noreferrer">Facebook</a>
            <a href="https://maps.app.goo.gl/PWLL5zE9fqVpmunj8" target="_blank" rel="noreferrer">Como chegar à fábrica</a>
          </div>
        </div>
      </section>
      <section className="marketing-cta" id="cadastro">
        <div className="marketing-reveal">
          <span>Clube Adoce</span>
          <h2>Faça parte do Clube Adoce</h2>
          <p>
            A cada fatia comprada, você recebe um carimbo. Complete 14 carimbos
            e ganhe uma fatia grátis.
          </p>
          <div>
            <a className="marketing-primary" href="#cadastro">
              Quero fazer parte <ArrowRight />
            </a>
            <a className="marketing-secondary" href="#entrar">
              Entrar no Clube
            </a>
          </div>
        </div>
      </section>
      <footer>
        <Brand />
        <div className="marketing-footer-links">
          <a href="/#termos">Termos</a>
          <a href="/#privacidade">Privacidade</a>
          <a href="/#encomendas">Encomendas</a>
        </div>
        <p>© 2026 Adoce Brigaderia · Fortaleza, Ceará</p>
      </footer>
    </main>
  );
}
