import { CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

const validationRoutes = [
  ["Início e identidade", "/#inicio"],
  ["Fatias de hoje", "/#adoce-hoje"],
  ["Cadastro simplificado", "/#cadastro"],
  ["Clube e cartão digital", "/#clube"],
  ["Pede Junto", "/#pede-junto"],
  ["Encomendas", "/#encomendas"],
  ["Operação", "/#operacao"],
  ["Fale com a Adoce", "/#fale-com-a-adoce"],
] as const;

export function isVisualNavigatorEnabled(value: string | undefined) {
  return value === "visual";
}

export default function HomologationVisualNavigator() {
  const [open, setOpen] = useState(false);

  if (!isVisualNavigatorEnabled(import.meta.env.VITE_ADOCE_VALIDATION_MODE)) {
    return null;
  }

  return (
    <aside
      className={`homologation-visual-navigator ${open ? "is-open" : ""}`}
      aria-label="Roteiro de validação visual"
    >
      <button
        className="homologation-visual-navigator-trigger"
        type="button"
        aria-expanded={open}
        aria-controls="homologation-visual-route-list"
        onClick={() => setOpen((current) => !current)}
      >
        <img src="/site/logo.webp" alt="Logo oficial da Adoce Brigaderia" />
        <span>
          <strong>Roteiro de validação</strong>
          <small>Abra as telas principais sem procurar no menu.</small>
        </span>
        {open ? <ChevronDown aria-hidden="true" /> : <ChevronUp aria-hidden="true" />}
      </button>

      {open ? (
        <div
          className="homologation-visual-navigator-content"
          id="homologation-visual-route-list"
        >
          <p>
            Revise aparência, textos, organização e experiência touch. Fluxos que
            dependem de credenciais externas podem permanecer em contingência.
          </p>
          <nav aria-label="Telas para validar">
            {validationRoutes.map(([label, href]) => (
              <a href={href} key={href} onClick={() => setOpen(false)}>
                <CheckCircle2 aria-hidden="true" />
                {label}
              </a>
            ))}
          </nav>
          <small>
            Identidade visual carregada diretamente dos assets oficiais do Portal.
          </small>
        </div>
      ) : null}
    </aside>
  );
}
