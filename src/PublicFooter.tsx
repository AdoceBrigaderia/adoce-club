import { useState } from "react";
import { Clock3, MapPin, Phone, X } from "lucide-react";
import { FaInstagram } from "react-icons/fa";
import { orderWhatsAppUrl } from "./order-whatsapp";
import { publicContactLinks } from "./public-contact-links";
import "./public-footer-2026.css";

const WHATSAPP_NUMBER = "5585981994370";

type FooterPanel = "location" | "hours" | null;

export default function PublicFooter() {
  const [panel, setPanel] = useState<FooterPanel>(null);

  return (
    <footer className="public-footer-2026">
      <button type="button" className="public-footer-item" onClick={() => setPanel("location")}>
        <MapPin aria-hidden="true" />
        <span>Nossa localização</span>
      </button>
      <button type="button" className="public-footer-item" onClick={() => setPanel("hours")}>
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

      {panel ? (
        <div className="public-footer-overlay" onClick={() => setPanel(null)}>
          <div className="public-footer-card" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="public-footer-card-close" onClick={() => setPanel(null)} aria-label="Fechar">
              <X aria-hidden="true" />
            </button>
            {panel === "location" ? (
              <>
                <MapPin aria-hidden="true" />
                <h3>Nossa localização</h3>
                <p>Av. da Saudade, S/N<br />Em frente à Reserva dos Ipês<br />Divino Espeto — Fortaleza/CE</p>
                <p>No Waze, Maps ou Uber, basta escrever <strong>"Cantinho da Adoce"</strong> que eles encontram o local certinho.</p>
                <p>No App 99, escreva o endereço: <strong>Rua Cento Quarto, 277, Passaré</strong>.</p>
              </>
            ) : (
              <>
                <Clock3 aria-hidden="true" />
                <h3>Horário de funcionamento</h3>
                <p>Terça a sábado<br />das 17h às 23h<br /><small>(ou enquanto durarem os estoques)</small></p>
              </>
            )}
          </div>
        </div>
      ) : null}
    </footer>
  );
}
