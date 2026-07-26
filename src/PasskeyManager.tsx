import { useCallback, useEffect, useState } from "react";
import { Fingerprint, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import {
  deletePasskeyBff,
  listPasskeysBff,
  registerPasskeyBff,
  renamePasskeyBff,
  type BffPasskey,
} from "./services/bff-passkeys";
import "./passkey-manager.css";

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export default function PasskeyManager({ onClose }: { onClose: () => void }) {
  const [passkeys, setPasskeys] = useState<BffPasskey[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    setMessage("");
    try {
      setPasskeys(await listPasskeysBff());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar as chaves.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const add = async () => {
    setBusy(true);
    setMessage("");
    try {
      await registerPasskeyBff("operation");
      setMessage("Biometria ou chave de acesso cadastrada neste aparelho.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível cadastrar este aparelho.");
      setBusy(false);
    }
  };

  const rename = async (passkey: BffPasskey) => {
    const current = passkey.friendly_name || "Meu aparelho";
    const next = window.prompt("Nome para identificar este aparelho:", current)?.trim();
    if (!next || next === current) return;
    setBusy(true);
    try {
      await renamePasskeyBff(passkey.id, next);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível renomear a chave.");
      setBusy(false);
    }
  };

  const remove = async (passkey: BffPasskey) => {
    const label = passkey.friendly_name || "esta chave de acesso";
    if (!window.confirm(`Revogar ${label}? Este aparelho deixará de entrar por biometria.`)) return;
    setBusy(true);
    try {
      await deletePasskeyBff(passkey.id);
      setMessage("Chave de acesso revogada.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível revogar a chave.");
      setBusy(false);
    }
  };

  return (
    <div className="passkey-manager-layer" role="dialog" aria-modal="true" aria-label="Chaves de acesso">
      <button className="passkey-manager-backdrop" aria-label="Fechar" onClick={onClose} />
      <section className="passkey-manager-panel">
        <header>
          <div><Fingerprint /><span><small>Segurança da conta</small><h2>Biometria e chaves de acesso</h2></span></div>
          <button type="button" onClick={onClose} aria-label="Fechar"><X /></button>
        </header>
        <p>O Portal Adoce nunca recebe sua digital ou Face ID. O aparelho apenas confirma uma prova criptográfica.</p>
        {message ? <div className="passkey-manager-message" role="status">{message}</div> : null}
        <button className="passkey-manager-add" type="button" onClick={() => void add()} disabled={busy}>
          <Plus /> Cadastrar este aparelho
        </button>
        <div className="passkey-manager-list" aria-busy={busy}>
          {busy && !passkeys.length ? <p>Carregando chaves…</p> : null}
          {!busy && !passkeys.length ? <p>Nenhuma chave cadastrada ainda.</p> : null}
          {passkeys.map((passkey) => (
            <article key={passkey.id}>
              <Fingerprint />
              <span>
                <strong>{passkey.friendly_name || "Chave de acesso"}</strong>
                <small>Criada {passkey.created_at ? dateTime.format(new Date(passkey.created_at)) : "recentemente"}</small>
                {passkey.last_used_at ? <small>Último uso {dateTime.format(new Date(passkey.last_used_at))}</small> : null}
              </span>
              <div>
                <button type="button" onClick={() => void rename(passkey)} disabled={busy} aria-label="Renomear"><Pencil /></button>
                <button type="button" onClick={() => void remove(passkey)} disabled={busy} aria-label="Revogar"><Trash2 /></button>
              </div>
            </article>
          ))}
        </div>
        <button className="passkey-manager-refresh" type="button" onClick={() => void load()} disabled={busy}>
          <RefreshCw /> Atualizar lista
        </button>
      </section>
    </div>
  );
}
