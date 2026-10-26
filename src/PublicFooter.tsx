import { Clock3, MapPin } from "lucide-react";
import "./public-footer-2026.css";

export default function PublicFooter() {
  return (
    <footer className="public-footer-2026">
      <img src="/brand-2026/logo-adoce-transparente.png" alt="Adoce Brigaderia" />
      <div>
        <MapPin aria-hidden="true" />
        <p>
          <strong>Nossa localização</strong>
          <br />Av. da Saudade, S/N
          <br />Em frente à Reserva dos Ipês
          <br />Divino Espeto — Fortaleza/CE
        </p>
      </div>
      <div>
        <Clock3 aria-hidden="true" />
        <p>
          <strong>Funcionamento</strong>
          <br />Terça a sábado
          <br />das 17h às 23h
          <br /><small>(ou enquanto durarem os estoques)</small>
        </p>
      </div>
    </footer>
  );
}
