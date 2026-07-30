import { useState } from "react";
import {
  CakeSlice,
  Check,
  Fingerprint,
  Gift,
  Heart,
  Nfc,
  QrCode,
  ShieldCheck,
  Smartphone,
  UserRound,
  WalletCards,
} from "lucide-react";
import "./passkey-client-gateway.css";
import "./homologation-access-preview.css";

const movements = [
  { delta: 3, label: "Carimbos lançados no atendimento", time: "Hoje, 20:14", progress: 9 },
  { delta: 1, label: "Compra registrada", time: "Sábado, 21:02", progress: 6 },
  { delta: -14, label: "Fatia grátis resgatada", time: "18 de julho, 19:48", progress: 5 },
];

export default function HomologationClientAccountPreview() {
  const [showQr, setShowQr] = useState(false);
  const progress = 9;

  return (
    <main className="passkey-client-gateway account homologation-access-preview">
      <header className="passkey-client-header">
        <a href="/#inicio" aria-label="Adoce Brigaderia">
          <img src="/site/logo.webp" alt="Adoce Brigaderia" />
          <span>
            <strong>Clube Adoce</strong>
            <small>Área demonstrativa do cliente</small>
          </span>
        </a>
        <span className="homologation-preview-pill">Modo visual</span>
      </header>

      <section className="homologation-preview-notice" role="status">
        <ShieldCheck />
        <div>
          <strong>Conta demonstrativa para validação</strong>
          <p>Os dados abaixo são fictícios. Nenhuma sessão real foi aberta e nenhuma ação será gravada.</p>
        </div>
      </section>

      <section className="passkey-client-welcome">
        <div>
          <small>Área do cliente</small>
          <h1>Olá, Cliente!</h1>
          <p>Cartão, QR, recompensas, check-in e segurança reunidos em poucos toques.</p>
        </div>
        <span>
          <Gift />
          <strong>1</strong>
          <small>fatia grátis</small>
        </span>
      </section>

      <section className="passkey-client-grid">
        <article className="passkey-client-loyalty-card">
          <header>
            <div>
              <small>CLUBE ADOCE</small>
              <h2>Meu cartão digital</h2>
            </div>
            <img src="/site/logo.webp" alt="" />
          </header>
          <div className="passkey-client-member">
            <span>Código do membro</span>
            <strong>ADOCE-002847</strong>
            <small>Cliente de demonstração</small>
          </div>
          <div className="passkey-client-progress-title">
            <strong>{progress} de 14 carimbos</strong>
            <span>Faltam {14 - progress}</span>
          </div>
          <div className="passkey-client-stamps" aria-label={`${progress} de 14 carimbos`}>
            {Array.from({ length: 14 }, (_, index) => (
              <span className={index < progress ? "filled" : ""} key={index}>
                <Heart />
              </span>
            ))}
          </div>
          <div className="passkey-client-card-actions">
            <button type="button" onClick={() => setShowQr(true)}>
              <QrCode /> Mostrar meu QR
            </button>
            <button type="button" onClick={() => undefined}>
              <WalletCards /> Adicionar à Wallet
            </button>
            <a href="/#adoce-hoje">
              <CakeSlice /> Sabores de hoje
            </a>
          </div>
        </article>

        <aside className="passkey-client-side">
          <article>
            <Nfc />
            <span>
              <small>Identificação rápida</small>
              <h3>Check-in no caixa</h3>
              <p>Encoste o celular na tag NFC ou leia o QR fixo da Adoce e confirme em um toque.</p>
            </span>
            <a href="/#check-in?loja=passare&caixa=principal">Ver check-in</a>
          </article>
          <article>
            <UserRound />
            <span>
              <small>Seu cadastro</small>
              <h3>Cliente de demonstração</h3>
              <p>(85) 9••••‑7403 · WhatsApp confirmado</p>
            </span>
          </article>
          <article>
            <Fingerprint />
            <span>
              <small>Acesso rápido</small>
              <h3>Biometria e passkey</h3>
              <p>Digital, Face ID, PIN ou chave de segurança sem enviar a biometria para a Adoce.</p>
            </span>
            <button type="button">Gerenciar aparelhos</button>
          </article>
          <article>
            <ShieldCheck />
            <span>
              <small>Segurança</small>
              <h3>Sessão protegida</h3>
              <p>Cookies HttpOnly, expiração curta e revogação de acesso.</p>
            </span>
          </article>
        </aside>
      </section>

      <section className="passkey-client-history">
        <header>
          <div>
            <small>Últimas atualizações</small>
            <h2>Movimentações do cartão</h2>
          </div>
          <button type="button"><Smartphone /> Atualizar</button>
        </header>
        {movements.map((entry) => (
          <article key={`${entry.label}-${entry.time}`}>
            <span className={entry.delta >= 0 ? "positive" : "negative"}>
              {entry.delta > 0 ? "+" : ""}{entry.delta}
            </span>
            <div>
              <strong>{entry.label}</strong>
              <small>{entry.time}</small>
            </div>
            <b>{entry.progress}/14</b>
          </article>
        ))}
      </section>

      {showQr ? (
        <div className="passkey-client-qr-layer" role="dialog" aria-modal="true" aria-label="QR demonstrativo do Clube Adoce">
          <button className="passkey-client-qr-backdrop" aria-label="Fechar" onClick={() => setShowQr(false)} />
          <section>
            <QrCode />
            <small>Cartão Clube Adoce</small>
            <h2>Mostre este QR no atendimento</h2>
            <div className="homologation-demo-qr" aria-label="QR demonstrativo">
              <QrCode aria-hidden="true" />
              <img src="/site/logo.webp" alt="" />
            </div>
            <strong>QR demonstrativo · não identifica cliente real</strong>
            <button type="button" onClick={() => setShowQr(false)}><Check /> Concluir</button>
          </section>
        </div>
      ) : null}
    </main>
  );
}
