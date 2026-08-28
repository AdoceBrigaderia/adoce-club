import { ArrowRight, Gift, Heart, QrCode, ShieldCheck } from "lucide-react";
import { ConnectedHomeClubCard, useConnectedClubSummary } from "./ConnectedClubSummary";
import { decidirPorta } from "./identidade-do-clube";
import "./public-site.css";
import "./adoce-app-2026.css";

export default function ClubExperience() {
  const { summary } = useConnectedClubSummary();
  const porta = decidirPorta({
    sessao: Boolean(summary),
    tokenDoCartao: null,
    membro: summary ? { primeiroNome: summary.firstName, carimbos: summary.progress } : null,
    tokenNaUrl: null,
  });
  return (
    <main className="public-site adoce-app-club">
      {summary ? (
        <section className="club-member-first"><ConnectedHomeClubCard summary={summary} /></section>
      ) : (
        <section className="app-club-hero">
          <div>
            <span>Clube Adoce</span>
            <h1>Cada fatia vale um carimbo.</h1>
            <p>Junte 14 carimbos e ganhe uma fatia tradicional.</p>
          </div>
          <img src="/site/clube-cartao-destaque-v2.webp" alt="Cartão digital do Clube Adoce" />
        </section>
      )}

      {porta.porta === "convite" ? (
        <section className="app-stamp-preview" aria-label="Exemplo de cartão com seis carimbos">
          <header><span>Seu cartão</span><strong>6 <small>de 14</small></strong></header>
          <div>{Array.from({ length: 14 }, (_, index) => <span className={index < 6 ? "filled" : ""} key={index}><Heart /></span>)}</div>
          <p>Faltam 8 carimbos para ganhar uma fatia.</p>
        </section>
      ) : null}

      <section className="app-club-benefits">
        <article><Heart /><strong>Acumule</strong><span>1 fatia = 1 carimbo</span></article>
        <article><Gift /><strong>Resgate</strong><span>14 carimbos = 1 fatia</span></article>
        <article><QrCode /><strong>Apresente</strong><span>Seu QR no atendimento</span></article>
      </section>

      {porta.porta === "convite" ? (
        <section className="app-club-access">
          <a className="app-button primary" href="/#cadastro">Quero entrar no Clube <ArrowRight /></a>
          <a className="app-button secondary" href="/#entrar">Já faço parte</a>
          <small><ShieldCheck /> Seus dados ficam protegidos.</small>
        </section>
      ) : null}
    </main>
  );
}
