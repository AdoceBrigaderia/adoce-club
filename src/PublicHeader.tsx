import { Menu, QrCode, X } from "lucide-react";
import { useState } from "react";
import type { ConnectedClubSummary } from "./ConnectedClubSummary";
import { useConnectedClubSummary } from "./ConnectedClubSummary";

const publicLinks = [
  ["Início", "/#inicio"],
  ["Fatias", "/#adoce-hoje"],
  ["Cardápio de fatias", "/#cardapio-fatias"],
  ["Tortas", "/#encomendas"],
  ["Docinhos", "/#docinhos"],
  ["Eventos", "/#eventos"],
  ["Adoce na Escola", "/#adoce-na-escola"],
  ["Aluguel de decoração", "/#aluguel-decoracao"],
] as const;

export default function PublicHeader({
  clubSummary,
}: {
  dark?: boolean;
  clubSummary?: ConnectedClubSummary | null;
}) {
  const [open, setOpen] = useState(false);
  const { summary: detectedClubSummary } = useConnectedClubSummary();
  const member = clubSummary === undefined ? detectedClubSummary : clubSummary;
  const firstName = member?.firstName || "Cliente";
  const progress = member?.progress || 0;
  const accountHref = member ? "/#minha-conta" : "/#entrar";

  return (
    <header className="public-header public-shell-header">
      <a className="public-member-greeting" href={accountHref}>
        <span>Olá,</span> <strong>{firstName}!</strong>
      </a>

      <a className="public-brand" href="/#inicio" aria-label="Adoce Brigaderia — início">
        <img src="/site/logo.webp" alt="Adoce Brigaderia" />
      </a>

      <div className="public-header-actions">
        {member ? <div className="public-member-status" aria-label={`${progress} de 14 carimbos`}>
          <a className="public-member-progress" href={accountHref}>
            <strong>{progress} de 14</strong>
          </a>
          <a className="public-member-qr" href={`${accountHref}?view=qr`} aria-label="Abrir meu QR Code">
            <QrCode />
          </a>
        </div> : null}
        <button
          className="public-menu"
          type="button"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>

      <nav className={open ? "open" : ""} aria-label="Navegação principal">
        {publicLinks.map(([label, href]) => (
          <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>
        ))}
        <a className="public-login" href={accountHref} onClick={() => setOpen(false)}>
          {member ? "Minha conta" : "Entrar no Clube"}
        </a>
      </nav>
    </header>
  );
}
