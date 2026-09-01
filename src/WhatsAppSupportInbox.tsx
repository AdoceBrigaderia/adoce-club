import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, MessageCircle, RefreshCw, Send } from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import "./whatsapp-support-inbox.css";

type SupportThreadSummary = {
  id: string;
  phone_last4: string;
  department: "festival" | "quote";
  status: "waiting" | "open";
  last_message_at: string;
  last_message?: string;
};

type SupportMessage = {
  id: number;
  direction: "inbound" | "outbound" | "system";
  body: string;
  created_at: string;
};

type SupportThread = SupportThreadSummary & { messages: SupportMessage[] };
type OrderNotificationHealth = { pending: number; failed: number; last_failure?: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const departmentLabel = (department: SupportThreadSummary["department"]) =>
  department === "festival" ? "Festival de Fatias" : "Orçamento";

async function supportRequest(path = "", init?: RequestInit) {
  const supabase = requireSupabase();
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Sua sessão expirou. Entre novamente na operação.");
  const response = await fetch(`/api/whatsapp/support${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Não foi possível carregar o atendimento.");
  return payload;
}

export default function WhatsAppSupportInbox() {
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const [threads, setThreads] = useState<SupportThreadSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [thread, setThread] = useState<SupportThread | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [orderHealth, setOrderHealth] = useState<OrderNotificationHealth | null>(null);

  const loadThread = useCallback(async (threadId: string) => {
    if (!UUID.test(threadId)) return;
    const payload = await supportRequest(`?thread=${encodeURIComponent(threadId)}`);
    setThread(payload.thread || null);
  }, []);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const payload = await supportRequest();
      const nextThreads = (payload.threads || []) as SupportThreadSummary[];
      setThreads(nextThreads);
      setOrderHealth(payload.orderNotificationHealth || null);
      const requested = new URLSearchParams(window.location.search).get("whatsapp") || "";
      const nextSelected = selectedId || (UUID.test(requested) ? requested : "");
      if (nextSelected && nextThreads.some((item) => item.id === nextSelected)) {
        setSelectedId(nextSelected);
        await loadThread(nextSelected);
      } else if (selectedId && !nextThreads.some((item) => item.id === selectedId)) {
        setSelectedId("");
        setThread(null);
      }
      setNotice("");
    } catch (error) {
      if (!quiet) setNotice(error instanceof Error ? error.message : "Não foi possível carregar os atendimentos.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [loadThread, selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!selectedId) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadThread(selectedId).catch(() => undefined);
      }
    }, 4_000);
    return () => window.clearInterval(timer);
  }, [loadThread, selectedId]);

  useEffect(() => {
    const messageList = messageListRef.current;
    if (!messageList || !thread) return;
    const frame = window.requestAnimationFrame(() => {
      messageList.scrollTop = messageList.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [thread?.id, thread?.messages?.length]);

  const selectThread = async (threadId: string) => {
    setSelectedId(threadId);
    setReply("");
    const url = new URL(window.location.href);
    url.searchParams.set("whatsapp", threadId);
    window.history.replaceState({}, "", url);
    try {
      await loadThread(threadId);
      setNotice("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível abrir a conversa.");
    }
  };

  const act = async (action: "reply" | "close") => {
    if (!selectedId || (action === "reply" && !reply.trim())) return;
    setBusy(true);
    try {
      await supportRequest("", {
        method: "POST",
        body: JSON.stringify({ action, threadId: selectedId, body: reply.trim() }),
      });
      setReply("");
      if (action === "close") {
        setSelectedId("");
        setThread(null);
        const url = new URL(window.location.href);
        url.searchParams.delete("whatsapp");
        window.history.replaceState({}, "", url);
      } else {
        await loadThread(selectedId);
      }
      await load(true);
      setNotice(action === "close" ? "Atendimento encerrado e automação liberada." : "Resposta enviada pelo número oficial.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível concluir a ação.");
    } finally {
      setBusy(false);
    }
  };

  const waitingCount = useMemo(
    () => threads.filter((item) => item.status === "waiting").length,
    [threads],
  );

  return (
    <section className="whatsapp-support" aria-labelledby="whatsapp-support-title">
      <header className="whatsapp-support-heading">
        <div>
          <span>WhatsApp oficial</span>
          <h2 id="whatsapp-support-title">Atendimentos humanos</h2>
          <p>Festival com Rubens · Orçamentos com a equipe responsável</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading}>
          <RefreshCw /> {loading ? "Atualizando…" : "Atualizar"}
        </button>
      </header>

      {notice ? <p className="whatsapp-support-notice" role="status">{notice}</p> : null}
      {orderHealth?.failed ? (
        <p className="whatsapp-support-order-alert" role="alert">
          Atenção: {orderHealth.failed} aviso(s) de pedido falharam nos últimos 7 dias. Confira os pedidos agora.
        </p>
      ) : null}
      {orderHealth?.pending ? (
        <p className="whatsapp-support-order-pending" role="status">
          {orderHealth.pending} aviso(s) de pedido aguardando confirmação do WhatsApp.
        </p>
      ) : null}

      <div className="whatsapp-support-layout">
        <aside className="whatsapp-support-list" aria-label="Conversas aguardando atendimento">
          <div className="whatsapp-support-list-title">
            <strong>{threads.length} em atendimento</strong>
            {waitingCount ? <span>{waitingCount} aguardando</span> : null}
          </div>
          {!loading && !threads.length ? (
            <p className="whatsapp-support-empty">Nenhum cliente aguardando agora.</p>
          ) : null}
          {threads.map((item) => (
            <button
              type="button"
              key={item.id}
              className={selectedId === item.id ? "is-selected" : ""}
              onClick={() => void selectThread(item.id)}
            >
              <MessageCircle />
              <span>
                <strong>{departmentLabel(item.department)}</strong>
                <small>Cliente final {item.phone_last4}</small>
                <em>{item.last_message || "Nova solicitação"}</em>
              </span>
              <time>{new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(item.last_message_at))}</time>
            </button>
          ))}
        </aside>

        <div className="whatsapp-support-conversation">
          {!thread ? (
            <div className="whatsapp-support-placeholder">
              <MessageCircle />
              <p>Escolha uma conversa para atender.</p>
            </div>
          ) : (
            <>
              <header>
                <div>
                  <strong>{departmentLabel(thread.department)}</strong>
                  <small>Cliente final {thread.phone_last4} · responde pelo número oficial</small>
                </div>
                <button type="button" onClick={() => void act("close")} disabled={busy}>
                  <CheckCircle2 /> Encerrar
                </button>
              </header>
              <div ref={messageListRef} className="whatsapp-support-messages" aria-live="polite">
                {(thread.messages || []).map((message) => (
                  <article key={message.id} className={`is-${message.direction}`}>
                    <p>{message.body}</p>
                    <time>{new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(message.created_at))}</time>
                  </article>
                ))}
              </div>
              <form onSubmit={(event) => { event.preventDefault(); void act("reply"); }}>
                <label htmlFor="whatsapp-support-reply">Responder pelo WhatsApp oficial</label>
                <div>
                  <textarea
                    id="whatsapp-support-reply"
                    value={reply}
                    maxLength={4000}
                    rows={3}
                    placeholder="Escreva sua resposta para o cliente"
                    onChange={(event) => setReply(event.target.value)}
                  />
                  <button type="submit" disabled={busy || !reply.trim()}>
                    <Send /> {busy ? "Enviando…" : "Enviar"}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
