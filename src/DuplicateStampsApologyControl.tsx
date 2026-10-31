import { useRef, useState } from "react";
import { requestApology, type ApologySummary } from "./services/duplicate-stamps-apology";

// Temporário; renderizado apenas na auditoria restrita ao proprietário.
export default function DuplicateStampsApologyControl() {
  const [summary, setSummary] = useState<ApologySummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const running = useRef(false);
  async function run(mode: "preview" | "send") {
    if (running.current) return;
    running.current = true; setBusy(true); setMessage("");
    try {
      const result = await requestApology(mode);
      if (mode === "send") {
        setMessage(`Lote: ${result.attempted} tentativas, ${result.sent} aceitas e ${result.failed} falhas.`);
        setSummary(await requestApology());
      } else setSummary(result);
    } catch (error) {
      setSummary(null);
      setMessage(error instanceof Error ? error.message : "Execução interrompida. Confira a auditoria.");
    } finally { running.current = false; setBusy(false); }
  }
  return <section className="audit-decisions" style={{ maxWidth: 880, margin: "0 auto", overflowWrap: "anywhere" }}>
    <header className="audit-decisions-heading"><h1>Aviso sobre os carimbos duplicados</h1>
      <p>Controle temporário do proprietário. Cada clique envia até 20 avisos. Tentativas anteriores ficam bloqueadas para evitar mensagens repetidas.</p></header>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
      <button type="button" disabled={busy} onClick={() => void run("preview")}>Conferir simulação</button>
      <button type="button" disabled={busy || !summary || summary.pending === 0 || summary.failed > 0 || summary.uncertain > 0} onClick={() => void run("send")}>Enviar próximo lote (até 20)</button>
    </div>
    {busy && <p role="status">Processando. Aguarde antes de outra ação.</p>}
    {message && <p role="status">{message}</p>}
    {summary && <div aria-live="polite">
      <p><strong>Destinatários: {summary.total}</strong> · Comuns: {summary.normal} · Fatia cancelada: {summary.reversed}</p>
      <p>Aceitos pela Twilio: <strong>{summary.sent}</strong> · Pendentes: <strong>{summary.pending}</strong> · Falhas: <strong>{summary.failed}</strong> · Sem resultado confirmado: <strong>{summary.uncertain}</strong></p>
      <h2>Exemplo comum</h2><p>{summary.examples.normal}</p>
      <h2>Exemplo com fatia cancelada</h2><p>{summary.examples.reversed}</p>
    </div>}
  </section>;
}
