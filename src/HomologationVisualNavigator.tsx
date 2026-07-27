import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Copy,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  buildVisualReviewMarkdown,
  createEmptyVisualReview,
  normalizeVisualReview,
  VISUAL_REVIEW_SESSION_KEY,
  visualReviewProgress,
  visualValidationRoutes,
  type VisualReviewStatus,
  type VisualValidationRouteId,
} from "./homologation-visual-review";

export function isVisualNavigatorEnabled(value: string | undefined) {
  return value === "visual";
}

function readStoredReview() {
  if (typeof window === "undefined") return createEmptyVisualReview();

  try {
    const stored = window.sessionStorage.getItem(VISUAL_REVIEW_SESSION_KEY);
    return stored ? normalizeVisualReview(JSON.parse(stored)) : createEmptyVisualReview();
  } catch {
    return createEmptyVisualReview();
  }
}

function readViewport() {
  if (typeof window === "undefined") return "não informado";
  return `${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio.toFixed(2)}x`;
}

function copyWithFallback(text: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);

  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand("copy");
  field.remove();

  if (!copied) throw new Error("Não foi possível copiar o relatório.");
  return Promise.resolve();
}

export default function HomologationVisualNavigator() {
  const enabled = isVisualNavigatorEnabled(
    import.meta.env.VITE_ADOCE_VALIDATION_MODE,
  );
  const [open, setOpen] = useState(false);
  const [review, setReview] = useState(readStoredReview);
  const [viewport, setViewport] = useState(readViewport);
  const [copyFeedback, setCopyFeedback] = useState("");
  const progress = useMemo(() => visualReviewProgress(review), [review]);
  const report = useMemo(
    () =>
      buildVisualReviewMarkdown(review, {
        commit: import.meta.env.VITE_ADOCE_PREVIEW_COMMIT,
        builtAt: import.meta.env.VITE_ADOCE_PREVIEW_BUILT_AT,
        url: typeof window === "undefined" ? undefined : window.location.origin,
        viewport,
      }),
    [review, viewport],
  );

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    window.sessionStorage.setItem(
      VISUAL_REVIEW_SESSION_KEY,
      JSON.stringify(review),
    );
  }, [enabled, review]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const updateViewport = () => setViewport(readViewport());
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, [enabled]);

  if (!enabled) return null;

  const updateStatus = (
    id: VisualValidationRouteId,
    status: VisualReviewStatus,
  ) => {
    setReview((current) => ({
      ...current,
      statuses: { ...current.statuses, [id]: status },
      updatedAt: new Date().toISOString(),
    }));
    setCopyFeedback("");
  };

  const updateRouteNote = (id: VisualValidationRouteId, note: string) => {
    setReview((current) => ({
      ...current,
      routeNotes: { ...current.routeNotes, [id]: note.slice(0, 800) },
      updatedAt: new Date().toISOString(),
    }));
    setCopyFeedback("");
  };

  const copyReport = async () => {
    try {
      await copyWithFallback(report);
      setCopyFeedback("Relatório copiado. Cole no atendimento ou no issue.");
    } catch {
      setCopyFeedback("Não foi possível copiar automaticamente neste navegador.");
    }
  };

  const resetReview = () => {
    setReview(createEmptyVisualReview());
    setCopyFeedback("Revisão reiniciada.");
  };

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
          <small>
            {progress.reviewed}/{progress.total} telas revisadas · {progress.adjust} ajustes
          </small>
        </span>
        {open ? <ChevronDown aria-hidden="true" /> : <ChevronUp aria-hidden="true" />}
      </button>

      {open ? (
        <div
          className="homologation-visual-navigator-content"
          id="homologation-visual-route-list"
        >
          <p>
            Abra cada tela, valide aparência e experiência touch e marque o resultado.
            Ao escolher Ajustar, descreva o problema naquela própria tela.
          </p>

          <div className="homologation-visual-review-progress" aria-live="polite">
            <span><strong>{progress.approved}</strong> aprovadas</span>
            <span><strong>{progress.adjust}</strong> com ajustes</span>
            <span><strong>{progress.pending}</strong> pendentes</span>
          </div>

          <nav aria-label="Telas para validar">
            {visualValidationRoutes.map(({ id, label, href }) => {
              const status = review.statuses[id];
              const routeNote = review.routeNotes[id];
              return (
                <article className={`homologation-visual-route is-${status}`} key={id}>
                  <a href={href} onClick={() => setOpen(false)}>
                    {status === "approved" ? (
                      <CheckCircle2 aria-hidden="true" />
                    ) : status === "adjust" ? (
                      <TriangleAlert aria-hidden="true" />
                    ) : (
                      <ClipboardCheck aria-hidden="true" />
                    )}
                    {label}
                  </a>
                  <div role="group" aria-label={`Resultado de ${label}`}>
                    <button
                      type="button"
                      aria-pressed={status === "approved"}
                      onClick={() => updateStatus(id, "approved")}
                    >
                      Aprovado
                    </button>
                    <button
                      type="button"
                      aria-pressed={status === "adjust"}
                      onClick={() => updateStatus(id, "adjust")}
                    >
                      Ajustar
                    </button>
                  </div>
                  {status === "adjust" || routeNote ? (
                    <label className="homologation-visual-route-note">
                      <span>O que precisa mudar em {label}?</span>
                      <textarea
                        value={routeNote}
                        maxLength={800}
                        placeholder="Ex.: aumentar botão, corrigir texto, trocar foto ou simplificar este passo."
                        onChange={(event) => updateRouteNote(id, event.target.value)}
                      />
                      <small>{routeNote.length}/800</small>
                    </label>
                  ) : null}
                </article>
              );
            })}
          </nav>

          <label className="homologation-visual-review-notes">
            <span>Observações gerais</span>
            <textarea
              value={review.notes}
              maxLength={4000}
              placeholder="Registre aqui apenas observações que se aplicam ao Portal inteiro."
              onChange={(event) =>
                setReview((current) => ({
                  ...current,
                  notes: event.target.value,
                  updatedAt: new Date().toISOString(),
                }))
              }
            />
          </label>

          <div className="homologation-visual-review-actions">
            <button type="button" onClick={() => void copyReport()}>
              <Copy aria-hidden="true" />
              Copiar relatório
            </button>
            <button type="button" onClick={resetReview}>
              <RotateCcw aria-hidden="true" />
              Reiniciar
            </button>
          </div>

          {copyFeedback ? <p className="homologation-visual-copy-feedback">{copyFeedback}</p> : null}

          <small>
            Relatório identificado por commit, build e tamanho atual da tela.
            Fluxos externos podem permanecer em contingência neste preview.
          </small>
        </div>
      ) : null}
    </aside>
  );
}
