import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { CheckCircle2, MessageCircle, RefreshCw, Send, Paperclip, Mic, Square, X } from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import { productionApiOrigin } from "./lib/native-api";
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
  media_kind?: "audio" | "image" | "video" | "document" | null;
  media_url?: string | null;
  media_content_type?: string | null;
  media_filename?: string | null;
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
  // No app do tablet o WebView é servido de https://localhost, então um
  // caminho relativo "/api/..." não chega à Netlify. O origin de produção
  // é montado explicitamente aqui em vez de depender do monkey-patch global
  // de fetch (cuja ordem de instalação vs. CapacitorHttp não é garantida).
  const native = Capacitor.isNativePlatform();
  const base = native ? productionApiOrigin : "";
  // O CapacitorHttp do Android guarda a resposta deste GET e ignora
  // Cache-Control: no-store, o header de request e o cache:"no-store" do
  // fetch -- o tablet servia uma lista de atendimentos congelada e os
  // clientes só apareciam no site. Só uma URL única por chamada fura esse
  // cache. A função ignora query params desconhecidos.
  const bust = native ? `${path.includes("?") ? "&" : "?"}_ts=${Date.now()}` : "";
  const response = await fetch(`${base}/api/whatsapp/support${path}${bust}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
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
  const [pendingReply, setPendingReply] = useState<SupportMessage | null>(null);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [recording, setRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderChunksRef = useRef<Blob[]>([]);
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
    const supabase = requireSupabase();
    const channel = supabase
      .channel("whatsapp-support-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "operation_notifications",
          filter: "event_type=eq.whatsapp.support.message",
        },
        (change) => {
          const entityId = String((change.new as { entity_id?: string }).entity_id || "");
          if (entityId === selectedId) void loadThread(entityId).catch(() => undefined);
          else void load(true);
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setNotice("Tempo real indisponível. Toque em Atualizar para conferir as mensagens.");
        }
      });
    return () => { void supabase.removeChannel(channel); };
  }, [load, loadThread, selectedId]);

  // No tablet (app Capacitor), quando a operação fica em segundo plano o
  // WebView é suspenso e o WebSocket do realtime cai -- as mensagens que
  // chegam nesse meio-tempo não são reentregues. Sem isto, o atendimento
  // só aparecia no site (aba do navegador não sofre esse corte). Recarrega
  // ao voltar o foco e mantém um polling leve enquanto a tela está visível.
  useEffect(() => {
    const resync = () => {
      if (document.visibilityState !== "visible") return;
      void load(true);
      if (selectedId) void loadThread(selectedId).catch(() => undefined);
    };
    const onVisible = () => { if (document.visibilityState === "visible") resync(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", resync);
    const interval = window.setInterval(resync, 30_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", resync);
      window.clearInterval(interval);
    };
  }, [load, loadThread, selectedId]);

  useEffect(() => {
    const messageList = messageListRef.current;
    if (!messageList || !thread) return;
    const frame = window.requestAnimationFrame(() => {
      messageList.scrollTop = messageList.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [thread?.id, thread?.messages?.length, pendingReply?.id]);

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
    if (!selectedId || (action === "reply" && !reply.trim() && !attachment)) return;
    const replyBody = reply.trim();
    setBusy(true);
    if (action === "reply") {
      setReply("");
      setPendingReply({ id: -Date.now(), direction: "outbound", body: replyBody, created_at: new Date().toISOString() });
    }
    try {
      const requestBody = attachment
        ? (() => {
          const form = new FormData();
          form.set("action", action);
          form.set("threadId", selectedId);
          form.set("body", replyBody);
          form.set("file", attachment);
          return form;
        })()
        : JSON.stringify({ action, threadId: selectedId, body: replyBody });
      await supportRequest("", {
        method: "POST",
        body: requestBody,
      });
      if (action === "close") {
        setSelectedId("");
        setThread(null);
        const url = new URL(window.location.href);
        url.searchParams.delete("whatsapp");
        window.history.replaceState({}, "", url);
      } else {
        await loadThread(selectedId);
        setPendingReply(null);
        setAttachment(null);
      }
      setNotice(action === "close" ? "Atendimento encerrado e automação liberada." : "Resposta enviada pelo número oficial.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível concluir a ação.");
      if (action === "reply") {
        setReply(replyBody);
        setPendingReply(null);
      }
      setNotice(error instanceof Error ? error.message : "NÃ£o foi possÃ­vel concluir a aÃ§Ã£o.");
    } finally {
      setBusy(false);
    }
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setNotice("Seu navegador não permite gravar áudio. Anexe um arquivo de áudio.");
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    recorderChunksRef.current = [];
    recorder.ondataavailable = (event) => { if (event.data.size) recorderChunksRef.current.push(event.data); };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(recorderChunksRef.current, { type: recorder.mimeType || "audio/webm" });
      setAttachment(new File([blob], `audio-${Date.now()}.webm`, { type: blob.type }));
      setRecording(false);
    };
    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
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
                {attachment ? <div className="whatsapp-support-attachment"><span>{attachment.name}</span><button type="button" onClick={() => setAttachment(null)} aria-label="Remover anexo"><X /></button></div> : null}
                <div>
                  <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*,application/pdf" hidden onChange={(event) => setAttachment(event.target.files?.[0] || null)} />
                  <button type="button" className="whatsapp-support-icon-button" onClick={() => fileInputRef.current?.click()} aria-label="Anexar foto, vídeo ou documento"><Paperclip /></button>
                  <strong>{departmentLabel(thread.department)}</strong>
                  <small>Cliente final {thread.phone_last4} · responde pelo número oficial</small>
                </div>
                <button type="button" onClick={() => void act("close")} disabled={busy}>
                  <CheckCircle2 /> Encerrar
                </button>
              </header>
              <div ref={messageListRef} className="whatsapp-support-messages" aria-live="polite">
                {[...(thread.messages || []), ...(pendingReply ? [pendingReply] : [])].map((message) => (
                  <article key={message.id} className={`is-${message.direction}`}>
                    {message.media_url && message.media_kind === "image" ? <img className="whatsapp-support-media-image" src={message.media_url} alt={message.media_filename || "Imagem recebida"} loading="lazy" /> : null}
                    {message.media_url && message.media_kind === "video" ? <video className="whatsapp-support-media-video" src={message.media_url} controls preload="metadata" /> : null}
                    {message.media_url && message.media_kind === "audio" ? <audio className="whatsapp-support-media-audio" src={message.media_url} controls preload="metadata" /> : null}
                    {message.media_url && message.media_kind === "document" ? <a className="whatsapp-support-media-document" href={message.media_url} target="_blank" rel="noreferrer">Abrir {message.media_filename || "documento"}</a> : null}
                    <p>{message.body}</p>
                    <time>{pendingReply?.id === message.id ? "Enviandoâ€¦" : new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(message.created_at))}</time>
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
                    placeholder="Escreva sua resposta. Enter envia; Shift+Enter quebra linha"
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void act("reply");
                      }
                    }}
                    onChange={(event) => setReply(event.target.value)}
                  />
                  <button type="submit" disabled={busy || (!reply.trim() && !attachment)}>
                    <Send /> {busy ? "Enviando…" : "Enviar"}
                  </button>
                </div>
                <button type="button" className={`whatsapp-support-record-button${recording ? " is-recording" : ""}`} onClick={() => recording ? stopRecording() : void startRecording()} disabled={busy}>
                  {recording ? <Square /> : <Mic />} {recording ? "Parar gravação" : "Gravar áudio"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
