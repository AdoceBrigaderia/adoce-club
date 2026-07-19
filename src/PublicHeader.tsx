import { Menu, X } from "lucide-react";
import { useState } from "react";

const publicLinks = [
  ["Fatias hoje", "/#adoce-hoje"],
  ["Encomendas", "/#encomendas"],
  ["Festas e eventos", "/#eventos"],
  ["Adoce na Escola", "/#adoce-na-escola"],
  ["Clube Adoce", "/#clube"],
] as const;

export default function PublicHeader({ dark = true }: { dark?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <header className={`public-header ${dark ? "dark" : "light"}`}>
      <a className="public-brand" href="/#inicio" aria-label="Adoce Brigaderia — início">
        <img src="/site/logo.webp" alt="" />
        <strong>Adoce Brigaderia</strong>
      </a>
      <nav className={open ? "open" : ""} aria-label="Navegação principal">
        {publicLinks.map(([label, href]) => (
          <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>
        ))}
        <a className="public-login" href="/#entrar" onClick={() => setOpen(false)}>Entrar no Clube</a>
      </nav>
      <button
        className="public-menu"
        type="button"
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <X /> : <Menu />}
      </button>
    </header>
  );
}
