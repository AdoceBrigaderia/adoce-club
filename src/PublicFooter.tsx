import { useEffect, useRef, useState } from "react";
import { Clock3, Copy, Heart, Info, MapPin, Phone, Store, X } from "lucide-react";
import { FaInstagram } from "react-icons/fa";
import { orderWhatsAppUrl } from "./order-whatsapp";
import { publicContactLinks } from "./public-contact-links";
import { cantinhoDaAdoceLocation, copyNinetyNineAddress } from "./public-location";
import "./public-footer-2026.css";
import "./public-location-modal.css";

const WHATSAPP_NUMBER = "5585981994370";

type FooterPanel = "location" | "hours" | null;

export default function PublicFooter() {
  const [panel, setPanel] = useState<FooterPanel>(null);
  const [copyNotice, setCopyNotice] = useState("");
  const locationTriggerRef = useRef<HTMLButtonElement>(null);
  const hoursTriggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);

  const openPanel = (next: Exclude<FooterPanel, null>, trigger: HTMLButtonElement | null) => {
    lastTriggerRef.current = trigger;
    setCopyNotice("");
    setPanel(next);
  };

  const closePanel = () => {
    setPanel(null);
    lastTriggerRef.current?.focus();
  };

  useEffect(() => {
    if (!panel) return;
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePanel();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel]);

  const copyNinetyNine = async () => {
    const copied = await copyNinetyNineAddress();
    setCopyNotice(
      copied
        ? "Endereço copiado! Abra a 99 e cole no campo de destino."
        : `Não deu para copiar automaticamente. Endereço: ${cantinhoDaAdoceLocation.ninetyNineAddress}`,
    );
  };

  return (
    <footer className="public-footer-2026">
      <button
        type="button"
        className="public-footer-item"
        ref={locationTriggerRef}
        onClick={() => openPanel("location", locationTriggerRef.current)}
      >
        <MapPin aria-hidden="true" />
        <span>Nossa localização</span>
      </button>
      <button
        type="button"
        className="public-footer-item"
        ref={hoursTriggerRef}
        onClick={() => openPanel("hours", hoursTriggerRef.current)}
      >
        <Clock3 aria-hidden="true" />
        <span>Horário de funcionamento</span>
      </button>
      <a
        className="public-footer-item"
        href={orderWhatsAppUrl(WHATSAPP_NUMBER, "Olá! Vim pelo site da Adoce e gostaria de atendimento.")}
        target="_blank"
        rel="noreferrer"
      >
        <Phone aria-hidden="true" />
        <span>Contato</span>
      </a>
      <a
        className="public-footer-item"
        href={publicContactLinks.instagram}
        target="_blank"
        rel="noreferrer"
      >
        <FaInstagram aria-hidden="true" />
        <span>Instagram</span>
      </a>

      <p className="public-footer-copyright">
        © {new Date().getFullYear()} Cantinho da Adoce · CNPJ 68.912.733/0001-36<br />
        Todos os direitos reservados.
      </p>

      {panel === "location" ? (
        <div className="public-footer-overlay" onMouseDown={closePanel}>
          <div
            className="public-location-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="public-location-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="public-footer-card-close"
              onClick={closePanel}
              aria-label="Fechar"
              ref={closeButtonRef}
            >
              <X aria-hidden="true" />
            </button>
            <div className="public-location-icon">
              <MapPin aria-hidden="true" />
            </div>
            <h3 id="public-location-title">Nossa localização</h3>
            <p className="public-location-subtitle">Estamos esperando por você!</p>
            <div className="public-location-divider" aria-hidden="true">
              <span />
              <Heart />
              <span />
            </div>
            <div className="public-location-address">
              <Store aria-hidden="true" />
              <div>
                <strong>{cantinhoDaAdoceLocation.name}</strong>
                <span>{cantinhoDaAdoceLocation.addressDisplay}</span>
                <small>
                  <MapPin aria-hidden="true" /> {cantinhoDaAdoceLocation.addressReference}
                </small>
              </div>
            </div>
            <p className="public-location-question">Como deseja chegar?</p>
            <div className="public-location-apps">
              <a
                className="public-location-app"
                href={cantinhoDaAdoceLocation.googleMapsUrl}
                target="_blank"
                rel="noreferrer"
              >
                <span className="public-location-app-icon maps">
                  <MapPin aria-hidden="true" />
                </span>
                <span>Maps</span>
              </a>
              <a
                className="public-location-app"
                href={cantinhoDaAdoceLocation.wazeUrl}
                target="_blank"
                rel="noreferrer"
              >
                <span className="public-location-app-icon waze">W</span>
                <span>Waze</span>
              </a>
              <a
                className="public-location-app"
                href={cantinhoDaAdoceLocation.uberUrl}
                target="_blank"
                rel="noreferrer"
              >
                <span className="public-location-app-icon uber">Uber</span>
                <span>Uber</span>
              </a>
              <button type="button" className="public-location-app" onClick={() => void copyNinetyNine()}>
                <span className="public-location-app-icon ninety-nine">99</span>
                <span>99</span>
              </button>
            </div>
            <div className="public-location-99-note">
              <Info aria-hidden="true" />
              <p>
                Vai utilizar a 99? O endereço de referência é{" "}
                <strong>{cantinhoDaAdoceLocation.ninetyNineAddress}</strong>. O desembarque fica a poucos
                metros da nossa loja.
              </p>
            </div>
            {copyNotice ? (
              <p className="public-location-copy-notice" role="status">
                <Copy aria-hidden="true" /> {copyNotice}
              </p>
            ) : null}
          </div>
        </div>
      ) : panel === "hours" ? (
        <div className="public-footer-overlay" onMouseDown={closePanel}>
          <div className="public-footer-card" onMouseDown={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="public-footer-card-close"
              onClick={closePanel}
              aria-label="Fechar"
              ref={closeButtonRef}
            >
              <X aria-hidden="true" />
            </button>
            <Clock3 aria-hidden="true" />
            <h3>Horário de funcionamento</h3>
            <p>Terça a sábado<br />das 17h às 23h<br /><small>(ou enquanto durarem os estoques)</small></p>
          </div>
        </div>
      ) : null}
    </footer>
  );
}
