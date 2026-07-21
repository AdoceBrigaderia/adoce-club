import { useEffect, useState } from "react";
import { FaFacebookF, FaInstagram, FaWhatsapp } from "react-icons/fa";
import { publicContactLinks, shouldShowPublicContactDock } from "./public-contact-links";
import "./public-contact-dock.css";

export default function PublicContactDock() {
  const [, refreshRoute] = useState(0);

  useEffect(() => {
    const handleHashChange = () => refreshRoute((version) => version + 1);
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  if (!shouldShowPublicContactDock(window.location.hostname, window.location.hash)) return null;

  return (
    <nav className="public-contact-dock" aria-label="Canais de contato da Adoce">
      <a
        href={publicContactLinks.facebook}
        target="_blank"
        rel="noreferrer"
        aria-label="Abrir Facebook da Adoce"
        title="Facebook"
        data-label="Facebook"
      >
        <FaFacebookF aria-hidden="true" />
      </a>
      <a
        href={publicContactLinks.instagram}
        target="_blank"
        rel="noreferrer"
        aria-label="Abrir Instagram da Adoce"
        title="Instagram"
        data-label="Instagram"
      >
        <FaInstagram aria-hidden="true" />
      </a>
      <a
        className="whatsapp"
        href={publicContactLinks.whatsappPrimary}
        target="_blank"
        rel="noreferrer"
        aria-label="Falar com a Adoce pelo WhatsApp principal"
        title="WhatsApp principal"
        data-label="WhatsApp principal"
      >
        <FaWhatsapp aria-hidden="true" />
        <small aria-hidden="true">1</small>
      </a>
      <a
        className="whatsapp"
        href={publicContactLinks.whatsappSecondary}
        target="_blank"
        rel="noreferrer"
        aria-label="Falar com a Adoce pelo segundo WhatsApp"
        title="Segundo WhatsApp"
        data-label="Segundo WhatsApp"
      >
        <FaWhatsapp aria-hidden="true" />
        <small aria-hidden="true">2</small>
      </a>
    </nav>
  );
}
