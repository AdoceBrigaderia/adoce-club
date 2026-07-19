import { useEffect, useState } from "react";
import { AlertTriangle, Check, RotateCcw, ShieldCheck } from "lucide-react";

type RollbackStatus = {
  configured: boolean;
  safeDeployLabel: string;
};

const confirmationPhrase = "RESTAURAR PRODUCAO";

export default function ProductionRollbackPanel({ accessToken }: { accessToken: string }) {
  const [status, setStatus] = useState<RollbackStatus | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch("/api/production-rollback", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Não foi possível verificar a restauração.");
        setStatus(body as RollbackStatus);
      })
      .catch((error) => {
        setStatus({ configured: false, safeDeployLabel: "não configurada neste ambiente" });
        setMessage(
          error instanceof Error
            ? "A restauração está desativada nesta prévia local. Ela só será liberada quando a versão segura for registrada no servidor."
            : "Restauração indisponível neste ambiente.",
        );
      });
  }, [accessToken]);

  const restoreProduction = async () => {
    if (confirmation !== confirmationPhrase) return;
    const approved = window.confirm(
      "Restaurar agora a versão segura anterior da produção?\n\nA experiência publicada será substituída automaticamente e a ação ficará registrada.",
    );
    if (!approved) return;

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/production-rollback", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirmation }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "A restauração não foi concluída.");
      setMessage("Restauração iniciada com sucesso. A versão segura voltará ao ar em instantes.");
      setConfirmation("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "A restauração não foi concluída.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rollback-panel">
      <div className="operation-title">
        <div>
          <span>Proteção da produção</span>
          <h1>Restauração com um botão</h1>
          <p>Disponível somente para o proprietário e executada pelo servidor.</p>
        </div>
        <div className="operation-role"><ShieldCheck /> Acesso protegido</div>
      </div>

      <article className="rollback-card">
        <RotateCcw />
        <div>
          <small>Versão segura registrada</small>
          <h2>{status?.safeDeployLabel || "Verificando..."}</h2>
          <p>
            Este comando recoloca no ar o deploy completo que estava em produção antes da atualização.
            Os dados dos membros são preservados.
          </p>
        </div>
        <span className={status?.configured ? "ready" : "pending"}>
          {status?.configured ? <><Check /> Pronto</> : "Configuração pendente"}
        </span>
      </article>

      <div className="rollback-warning">
        <AlertTriangle />
        <p>
          Para evitar acionamento acidental, digite <strong>{confirmationPhrase}</strong> e confirme uma segunda vez.
        </p>
      </div>
      <label className="rollback-confirmation">
        Confirmação de segurança
        <input
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value.toUpperCase())}
          placeholder={confirmationPhrase}
          autoComplete="off"
        />
      </label>
      <button
        className="access-secondary danger rollback-button"
        disabled={busy || !status?.configured || confirmation !== confirmationPhrase}
        onClick={() => void restoreProduction()}
      >
        <RotateCcw /> {busy ? "Restaurando..." : "Restaurar produção anterior agora"}
      </button>
      {message && <div className="access-message" role="status">{message}</div>}
    </section>
  );
}

export function ProductionRollbackDemo() {
  return (
    <main className="operation-home">
      <header>
        <a className="access-brand" href="/"><img src="/site/logo.webp" alt="Adoce Brigaderia" /><span><strong>Adoce Operação</strong><small>Prévia local</small></span></a>
        <div><span>Proprietário</span><a href="/">Voltar</a></div>
      </header>
      <div className="operation-shell">
        <aside><button className="active"><RotateCcw /> Restaurar produção</button></aside>
        <section className="operation-work"><ProductionRollbackPanel accessToken="preview-local" /></section>
      </div>
    </main>
  );
}
