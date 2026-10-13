import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import "./confirm-dialog.css";

// Substitui window.confirm: no WebView do tablet Android o diálogo nativo é
// inconsistente (às vezes nem aparece). Este diálogo é da própria operação,
// funciona igual em todos os aparelhos e deixa a ação destrutiva em destaque.

type ConfirmOptions = {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

function ConfirmDialog({
  message,
  title,
  confirmLabel,
  cancelLabel,
  destructive,
  onClose,
}: ConfirmOptions & { message: string; onClose: (confirmed: boolean) => void }) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="adoce-confirm-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(false); }}>
      <div className="adoce-confirm" role="alertdialog" aria-modal="true" aria-labelledby="adoce-confirm-title" aria-describedby="adoce-confirm-message">
        <h2 id="adoce-confirm-title">{title || "Confirmar ação"}</h2>
        <p id="adoce-confirm-message">{message}</p>
        <div>
          <button type="button" ref={cancelRef} onClick={() => onClose(false)}>
            {cancelLabel || "Cancelar"}
          </button>
          <button type="button" className={destructive ? "is-destructive" : "is-primary"} onClick={() => onClose(true)}>
            {confirmLabel || "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function confirmAction(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  return new Promise((resolve) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const previousFocus = document.activeElement as HTMLElement | null;
    const close = (confirmed: boolean) => {
      root.unmount();
      host.remove();
      previousFocus?.focus?.();
      resolve(confirmed);
    };
    root.render(<ConfirmDialog message={message} {...options} onClose={close} />);
  });
}
