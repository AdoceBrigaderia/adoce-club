import { useEffect, useRef, useState } from "react";
import { Mail, MessageCircle, X } from "lucide-react";
import { FaFacebookF, FaInstagram, FaWhatsapp } from "react-icons/fa";
import {
  publicContactLinks,
  shouldShowPublicContactDock,
} from "./public-contact-links";
import "./public-contact-dock.css";

export default function PublicContactDock() {
  const [, refreshRoute] = useState(0);
  const [open, setOpen] = useState(false);
  const dockRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleHashChange = () => {
      setOpen(false);
      refreshRoute((version) => version + 1);
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!dockRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [open]);

  if (
    !shouldShowPublicContactDock(
      window.location.hostname,
      window.location.hash,
    )
  )
    return null;

  return (
    <nav
      ref={dockRef}
      className="public-contact-dock"
      aria-label="Canais de contato da Adoce"
    >
      {open ? (
        <div className="public-contact-menu" id="public-contact-menu">
          <header>
            <div>
              <span>Fale com a gente</span>
              <strong>Como podemos adoçar seu dia?</strong>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar contatos"
            >
              <X aria-hidden="true" />
            </button>
          </header>
          <a
            className="facebook"
            href={publicContactLinks.facebook}
            target="_blank"
            rel="noreferrer"
          >
            <FaFacebookF aria-hidden="true" />
            <span>
              <strong>Facebook</strong>
              <small>Acompanhe a Adoce</small>
            </span>
          </a>
          <a
            className="instagram"
            href={publicContactLinks.instagram}
            target="_blank"
            rel="noreferrer"
          >
            <FaInstagram aria-hidden="true" />
            <span>
              <strong>Instagram</strong>
              <small>Novidades e bastidores</small>
            </span>
          </a>
          <a
            className="whatsapp"
            href={publicContactLinks.whatsappPrimary}
            target="_blank"
            rel="noreferrer"
          >
            <FaWhatsapp aria-hidden="true" />
            <span>
              <strong>WhatsApp principal</strong>
              <small>Pedidos e atendimento</small>
            </span>
          </a>
          <a
            className="whatsapp"
            href={publicContactLinks.whatsappSecondary}
            target="_blank"
            rel="noreferrer"
          >
            <FaWhatsapp aria-hidden="true" />
            <span>
              <strong>Segundo WhatsApp</strong>
              <small>Outra opção de atendimento</small>
            </span>
          </a>
          <a className="email" href={publicContactLinks.emailAtendimento}>
            <Mail aria-hidden="true" />
            <span>
              <strong>E-mail</strong>
              <small>Canal oficial de atendimento</small>
            </span>
          </a>
        </div>
      ) : null}
      <button
        className="public-contact-trigger"
        type="button"
        aria-expanded={open}
        aria-controls="public-contact-menu"
        onClick={() => setOpen((current) => !current)}
      >
        <MessageCircle aria-hidden="true" />
        <span>Contatos</span>
      </button>
    </nav>
  );
}
