import { ArrowLeft, ArrowRight, Heart, MessageCircle } from "lucide-react";
import PublicHeader from "./PublicHeader";
import "./public-site.css";

export default function ClubExperience() {
  return (
    <main className="public-site club-experience">
      <PublicHeader dark={false} />
      <section className="club-intro">
        <a className="public-back" href="/#inicio"><ArrowLeft /> Voltar à Adoce</a>
        <div>
          <p className="public-kicker">O Clube Adoce</p>
          <h1>Seu cartão agora é digital — <em>mas a tradição continua.</em></h1>
          <p>A cada fatia, você ganha 1 carimbo. Complete 14 e ganhe uma fatia grátis.</p>
          <div className="public-actions">
            <a className="public-primary" href="/#cadastro">Quero fazer parte <ArrowRight /></a>
            <a className="public-secondary" href="/#entrar">Entrar no Clube</a>
          </div>
        </div>
        <img src="/site/hero-cake.webp" alt="Fatia de chocolate da Adoce" />
      </section>

      <section className="approved-club-visual" aria-labelledby="club-inside-title">
        <div className="approved-club-heading">
          <p className="public-kicker">Experiência aprovada</p>
          <h2 id="club-inside-title">Veja o Clube por dentro</h2>
          <p>Cartão, QR, Adoce Hoje e Fatia Grátis reunidos na mesma experiência.</p>
        </div>
        <picture>
          <source media="(max-width: 520px)" srcSet="/site/clube-aprovado-mobile-claro.png" />
          <source media="(max-width: 900px)" srcSet="/site/clube-aprovado-mobile-escuro.png" />
          <img src="/site/clube-aprovado-desktop.png" alt="Apresentação visual do Clube Adoce com cartão digital, QR Code, Adoce Hoje e fatia grátis" />
        </picture>
      </section>

      <section className="club-share-call">
        <div>
          <p className="public-kicker">Compartilhe momentos, multiplique doçura</p>
          <h2>Compartilhe <em>Doçura.</em></h2>
          <p>Convide amigos para o Clube ou crie um Cartão em Grupo. Mais pessoas, mais carimbos e mais momentos juntos.</p>
          <div className="public-actions">
            <a className="public-primary" href="/#cadastro">Convidar alguém <ArrowRight /></a>
            <a className="public-secondary on-dark" href="/#entrar"><MessageCircle /> Entrar e compartilhar</a>
          </div>
        </div>
        <div className="group-progress-card">
          <span>Nosso grupo</span>
          <h3>Doçura em Boa Companhia</h3>
          <div className="group-hearts">{Array.from({ length: 14 }, (_, index) => <Heart className={index < 8 ? "filled" : ""} key={index} />)}</div>
          <strong>8 de 14 carimbos</strong>
          <small>Faltam 6 carimbos para a próxima fatia grátis.</small>
        </div>
      </section>

      <footer className="public-footer">
        <a className="public-brand" href="/#inicio"><img src="/site/logo.webp" alt="" /><strong>Adoce Brigaderia</strong></a>
        <p>Clube Adoce · A tradição continua no digital.</p>
        <div><a href="/#termos">Termos</a><a href="/#privacidade">Privacidade</a></div>
      </footer>
    </main>
  );
}
