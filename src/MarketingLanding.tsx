import {
  ArrowRight,
  CakeSlice,
  Gift,
  Heart,
  Leaf,
  ShoppingBag,
  QrCode,
} from "lucide-react";
import { useConnectedClubSummary } from "./ConnectedClubSummary";
import "./public-site.css";

export default function MarketingLanding() {
  const { summary } = useConnectedClubSummary();
  const progress = summary?.progress || 0;
  const remaining = Math.max(0, 14 - progress);

  return (
    <main className="public-site adoce-app-home adoce-home-reference" id="inicio">
      <section className="home-reference-hero" aria-labelledby="home-reference-title">
        <img
          className="home-reference-product"
          src="/site/portal-entry-fatias.png"
          alt="Fatia real da Adoce na embalagem de retirada"
        />

        <div className="home-reference-copy">
          <p>Bem-vindo à</p>
          <h1 id="home-reference-title"><em>Adoce</em><br />Brigaderia</h1>
          <span aria-hidden="true" />
          <p>Doces feitos com amor<br />para adoçar seus momentos</p>
        </div>

        <div className="home-reference-differentials" aria-label="Diferenciais da Adoce">
          <article>
            <span><Leaf /></span>
            <p><strong>Ingredientes</strong><small>selecionados</small></p>
          </article>
          <article>
            <span><Heart /></span>
            <p><strong>Feito com</strong><small>carinho</small></p>
          </article>
        </div>
      </section>

      <section className="home-reference-actions" aria-label="Ações principais">
        <a className="home-reference-order" href="/#adoce-hoje">
          <span><ShoppingBag /></span>
          <strong>Fazer meu pedido</strong>
          <ArrowRight />
        </a>
        <a className="home-reference-flavors" href="/#adoce-hoje">
          Ver fatias disponíveis <ArrowRight />
        </a>
      </section>

      <section className="home-reference-commercial" aria-label="Catálogo Adoce">
        <a className="home-reference-card cakes" href="/#encomendas">
          <span className="home-reference-card-icon"><CakeSlice /></span>
          <div>
            <h2>Tortas incríveis</h2>
            <p>Sabor que encanta</p>
          </div>
          <span className="home-reference-card-arrow"><ArrowRight /></span>
        </a>

        <a className="home-reference-card slices" href="/#adoce-hoje">
          <span className="home-reference-card-icon"><Gift /></span>
          <img src="/adoce-hoje/chocolatudo.webp" alt="Fatia generosa da Adoce" />
          <div>
            <h2>Fatias generosas</h2>
            <p>Perfeitas para<br />qualquer momento</p>
          </div>
          <span className="home-reference-card-arrow"><ArrowRight /></span>
        </a>
      </section>

      <section className="home-reference-club" aria-label="Clube Adoce. Cada fatia vale um carimbo.">
        <div className="home-reference-club-copy">
          <p>Clube Adoce</p>
          <div className="home-reference-club-title">
            <h2 id="home-club-title">Seu cartão</h2>
            <strong><em>{progress}</em> de 14</strong>
          </div>
          <div className="home-reference-stamps" aria-label={`${progress} de 14 carimbos`}>
            {Array.from({ length: 14 }, (_, index) => (
              <span className={index < progress ? "filled" : ""} key={index}><Heart /></span>
            ))}
          </div>
          <p className="home-reference-club-remaining">
            Faltam <strong>{remaining} carimbos</strong> para ganhar uma fatia.
          </p>
        </div>

        <div className="home-reference-club-brand">
          <img src="/site/logo.webp" alt="Adoce Brigaderia" />
          <p>Complete <strong>14 carimbos</strong><br />e ganhe uma fatia tradicional.</p>
        </div>

        <div className="home-reference-club-benefits" aria-label="Como funciona o Clube Adoce">
          <article><Heart /><p><strong>Acumule</strong><span>1 fatia = 1 carimbo</span></p></article>
          <article><Gift /><p><strong>Resgate</strong><span>14 carimbos = 1 fatia</span></p></article>
          <article><QrCode /><p><strong>Apresente</strong><span>Seu QR no atendimento</span></p></article>
        </div>

        <div className="home-reference-club-actions">
          <a className="primary" href={summary ? "/#minha-conta" : "/#cadastro"}>
            {summary ? "Abrir meu Clube" : "Quero entrar no Clube"} <ArrowRight />
          </a>
          {!summary && <a className="secondary" href="/#entrar">Já faço parte</a>}
        </div>
      </section>
    </main>
  );
}
