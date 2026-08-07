import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, Send, Unplug } from "lucide-react";
import "./meta-catalog-admin.css";
import { metaCatalogRequest } from "./services/meta-catalog-admin";

type MetaStatus = {
  configured: boolean;
  connection: { connected: boolean; name?: string; error?: string };
  counts: { enabled: number; synced: number; submitted: number; pending: number; errors: number };
  lastFullSync: { created_at: string; status: string; response_summary: string | null } | null;
};

type MetaHistoryItem = {
  id: number;
  retailer_id: string | null;
  operation: string;
  origin: string;
  status: string;
  http_status: number | null;
  error_message: string | null;
  created_at: string;
};

const dateTime = (value: string) => new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short", timeStyle: "short", timeZone: "America/Fortaleza",
}).format(new Date(value));

const labels: Record<string, string> = {
  create: "Criar produto", update: "Atualizar produto", availability: "Disponibilidade",
  validate: "Valida??o", full_sync: "Cat?logo completo", batch_status: "Conferir lote",
  manual: "Manual", automatic: "Autom?tica", reconciliation: "Reconcilia??o",
  submitted: "Enviado", synced: "Sincronizado", error: "Erro", skipped: "Ignorado", started: "Iniciado",
};

export default function MetaCatalogAdmin({ onProductsChanged }: { onProductsChanged: () => Promise<void> }) {
  const [status, setStatus] = useState<MetaStatus | null>(null);
  const [history, setHistory] = useState<MetaHistoryItem[]>([]);
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const request = useCallback(async (path: string, init?: RequestInit) => {
    const response = await metaCatalogRequest(path, init);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((payload as { error?: string }).error || `Falha HTTP ${response.status}.`);
    return payload;
  }, []);

  const load = useCallback(async () => {
    try {
      const query = filter ? `?status=${encodeURIComponent(filter)}&limit=50` : "?limit=50";
      const [statusPayload, historyPayload] = await Promise.all([
        request("/api/admin/integrations/meta/catalog/status"),
        request(`/api/admin/integrations/meta/catalog/history${query}`),
      ]);
      setStatus(statusPayload as MetaStatus);
      setHistory((historyPayload as { history?: MetaHistoryItem[] }).history || []);
      setMessage("");
    } catch (error) {
      setStatus(null);
      setHistory([]);
      setMessage(error instanceof Error ? error.message : "N?o foi poss?vel consultar a integra??o.");
    }
  }, [filter, request]);

  useEffect(() => { void load(); }, [load]);

  const run = async (path: string, success: string) => {
    setBusy(true);
    setMessage("");
    try {
      await request(path, { method: "POST" });
      setMessage(success);
      await Promise.all([load(), onProductsChanged()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "A sincroniza??o n?o foi conclu?da.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="meta-catalog-admin" aria-labelledby="meta-catalog-title">
      <header>
        <div>
          <small>WhatsApp Business</small>
          <h2 id="meta-catalog-title">Cat?logo da Meta</h2>
          <p>O portal ? a fonte oficial. A Meta recebe somente produtos marcados para exibi??o.</p>
        </div>
        <span className={status?.connection.connected ? "connected" : "disconnected"}>
          {status?.connection.connected ? <CheckCircle2 /> : <Unplug />}
          {status?.connection.connected ? status.connection.name || "Conectado" : "Aguardando conex?o"}
        </span>
      </header>

      {message ? <div className="meta-catalog-message" role="status"><AlertTriangle />{message}</div> : null}

      <div className="meta-catalog-metrics">
        <span><strong>{status?.counts.enabled ?? "?"}</strong><small>exibidos</small></span>
        <span><strong>{status?.counts.synced ?? "?"}</strong><small>sincronizados</small></span>
        <span><strong>{status ? status.counts.pending + status.counts.submitted : "?"}</strong><small>em processamento</small></span>
        <span className={status?.counts.errors ? "has-error" : ""}><strong>{status?.counts.errors ?? "?"}</strong><small>com erro</small></span>
      </div>

      <div className="meta-catalog-actions">
        <button type="button" disabled={busy || !status?.configured} onClick={() => void run("/api/admin/integrations/meta/catalog/sync", "Sincroniza??o completa enviada para processamento.")}><Send /> Sincronizar cat?logo completo</button>
        <button type="button" disabled={busy || !status?.configured} onClick={() => void run("/api/admin/integrations/meta/catalog/retry-errors", "Produtos com erro enviados novamente.")}><RefreshCw /> Reprocessar erros</button>
        <span><Clock3 /> ?ltima sincroniza??o: {status?.lastFullSync ? dateTime(status.lastFullSync.created_at) : "ainda n?o realizada"}</span>
      </div>

      <div className="meta-catalog-history-head">
        <div><strong>Hist?rico de sincroniza??es</strong><small>Respostas resumidas, sem credenciais.</small></div>
        <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filtrar hist?rico por situa??o">
          <option value="">Todas as situa??es</option>
          <option value="synced">Sincronizadas</option>
          <option value="submitted">Enviadas</option>
          <option value="error">Com erro</option>
          <option value="skipped">Ignoradas</option>
        </select>
      </div>
      <div className="meta-catalog-history">
        {history.map((item) => (
          <article key={item.id}>
            <span><strong>{item.retailer_id || labels[item.operation] || item.operation}</strong><small>{labels[item.operation] || item.operation} ? {labels[item.origin] || item.origin}</small></span>
            <b className={`status-${item.status}`}>{labels[item.status] || item.status}</b>
            <time>{dateTime(item.created_at)}</time>
            {item.error_message ? <p>{item.error_message}</p> : null}
          </article>
        ))}
        {!history.length ? <p className="meta-catalog-empty">O hist?rico aparecer? ap?s a primeira tentativa de sincroniza??o.</p> : null}
      </div>
    </section>
  );
}
