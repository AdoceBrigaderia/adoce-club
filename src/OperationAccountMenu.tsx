import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Download, LogOut, UserRound } from "lucide-react";

type Props = {
  name: string;
  avatarUrl?: string;
  roleLabel: string;
  onInstall: () => void;
  onSignOut: () => void;
};

// Menu da conta sempre visível no cabeçalho da operação: o tablet do balcão é
// compartilhado, então trocar de operador precisa estar a um toque em qualquer tela.
export default function OperationAccountMenu({ name, avatarUrl, roleLabel, onInstall, onSignOut }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();
  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);
  const firstName = name.trim().split(/\s+/)[0] || "Equipe";
  return (
    <div className="operation-account" ref={rootRef}>
      <button
        type="button"
        className="operation-account-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Conta de ${firstName}: trocar operador ou sair`}
        onClick={() => setOpen((current) => !current)}
      >
        {avatarUrl ? <img src={avatarUrl} alt="" /> : <UserRound aria-hidden="true" />}
        <span>{firstName}</span>
        <ChevronDown aria-hidden="true" />
      </button>
      {open ? (
        <div className="operation-account-menu" id={menuId} role="menu">
          <p>
            <strong>{name || "Equipe Adoce"}</strong>
            <small>{roleLabel}</small>
          </p>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onInstall(); }}>
            <Download aria-hidden="true" /> Instalar aplicativo
          </button>
          <button type="button" role="menuitem" className="danger" onClick={() => { setOpen(false); onSignOut(); }}>
            <LogOut aria-hidden="true" /> Sair / trocar operador
          </button>
        </div>
      ) : null}
    </div>
  );
}
