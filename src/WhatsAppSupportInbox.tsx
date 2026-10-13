import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { CalendarClock, CheckCircle2, MessageCircle, RefreshCw, RotateCcw, Send, Paperclip, Mic, Square, Trash2, X } from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import { productionApiOrigin } from "./lib/native-api";
import "./whatsapp-support-inbox.css";

// Telefone completo quando o servidor já identificou o cliente; senão, o final.
const contactPhoneLabel = (item: { phone_e164?: string | null; phone_last4: string }) => {
  const digits = (item.phone_e164 || "").replace(/\D/g, "").replace(/^55/, "");
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `Telefone final ${item.phone_last4}`;
};

type SupportThreadSummary = {
  id: string;
  phone_last4: string;
  phone_e164?: string | null;
  customer_name?: string | null;
  department: "festival" | "quote";
  status: "waiting" | "open" | "closed";
  automation_mode?: "bot" | "human";
  assigned_staff_user_id?: string | null;
  last_message_at: string;
  last_message?: string;
  has_customer_messages?: boolean;
};

type SupportMessage = {
  id: number;
  direction: "inbound" | "outbound" | "system";
  body: string;
  created_at: string;
  author_kind?: "customer" | "bot" | "staff" | "system";
  media_kind?: "audio" | "image" | "video" | "document" | null;
  media_url?: string | null;
  media_content_type?: string | null;
  media_filename?: string | null;
};

type ScheduledSupportMessage = {
  id: string;
  body: string;
  scheduled_at: string;
  status: "pending" | "processing" | "failed";
  last_error?: string | null;
};
type SupportThread = SupportThreadSummary & { messages: SupportMessage[]; scheduled_messages?: ScheduledSupportMessage[] };
type OrderNotificationHealth = { pending: number; failed: number; last_failure?: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const departmentLabel = (department: SupportThreadSummary["department"]) =>
  department === "festival" ? "Festival de Fatias" : "Orçamento";
const nextHourValue = () => {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
};

export async function supportRequest(path = "", init?: RequestInit) {
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
  const [view, setView] = useState<"active" | "history">("active");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [thread, setThread] = useState<SupportThread | null>(null);
  const selectedRef = useRef("");
  const nearBottomRef = useRef(true);
  const [reply, setReply] = useState("");
  const [scheduleAt, setScheduleAt] = useState(nextHourValue);
  const [startOpen, setStartOpen] = useState(false);
  const [startPhone, setStartPhone] = useState("");
  const [startBody, setStartBody] = useState("");
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
    if (selectedRef.current !== threadId) return;
    setThread(payload.thread || null);
    if(payload.thread) setThreads((items)=>items.map((item)=>item.id===threadId?{...item,automation_mode:payload.thread.automation_mode,status:payload.thread.status,assigned_staff_user_id:payload.thread.assigned_staff_user_id}:item));
  }, []);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const payload = await supportRequest(view === "history" ? "?view=history" : "");
      const nextThreads = (payload.threads || []) as SupportThreadSummary[];
      setThreads(nextThreads);
      setOrderHealth(payload.orderNotificationHealth || null);
      // Usa sempre a conversa selecionada AGORA (ref), nunca a capturada quando
      // esta busca começou: buscas antigas terminando depois de uma troca de
      // conversa faziam a tela voltar sozinha para o chat anterior.
      const current = selectedRef.current;
      const requested = new URLSearchParams(window.location.search).get("whatsapp") || "";
      const nextSelected = current || (UUID.test(requested) ? requested : "");
      if (nextSelected && nextThreads.some((item) => item.id === nextSelected)) {
        if (selectedRef.current !== nextSelected && selectedRef.current) return;
        selectedRef.current = nextSelected; setSelectedId(nextSelected);
        await loadThread(nextSelected);
      } else if (current && current === selectedRef.current && !nextThreads.some((item) => item.id === current)) {
        selectedRef.current = ""; setSelectedId("");
        setThread(null);
      }
      setNotice("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível carregar os atendimentos.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [loadThread, view]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const phone = params.get("whatsappStart") || "";
    if (!phone) return;
    setStartOpen(true);
    setStartPhone(phone);
    setView("active");
  }, []);

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
          if (entityId === selectedRef.current) void loadThread(entityId).catch(() => undefined);
          else void load(true);
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setNotice("Tempo real indisponível. Toque em Atualizar para conferir as mensagens.");
        }
      });
    return () => { void supabase.removeChannel(channel); };
  }, [load, loadThread]);

  // No tablet (app Capacitor), quando a operação fica em segundo plano o
  // WebView é suspenso e o WebSocket do realtime cai -- as mensagens que
  // chegam nesse meio-tempo não são reentregues. Sem isto, o atendimento
  // só aparecia no site (aba do navegador não sofre esse corte). Recarrega
  // ao voltar o foco e mantém um polling leve enquanto a tela está visível.
  useEffect(() => {
    const resync = () => {
      if (document.visibilityState !== "visible") return;
      void load(true);
      if (selectedRef.current) void loadThread(selectedRef.current).catch(() => undefined);
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
  }, [load, loadThread]);

  useEffect(() => {
    const messageList = messageListRef.current;
    if (!messageList || !thread) return;
    const frame = window.requestAnimationFrame(() => {
      if (nearBottomRef.current) messageList.scrollTop = messageList.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [thread?.id, thread?.messages?.length, pendingReply?.id]);

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") void load(true); };
    const timer = window.setInterval(refresh, 5000);
    window.addEventListener("focus", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [load]);

  const selectThread = async (threadId: string) => {
    selectedRef.current = threadId; nearBottomRef.current = true; setThread(null); setSelectedId(threadId);
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

  const act = async (action: "reply" | "close" | "takeover" | "resume" | "reopen" | "schedule") => {
    if (action === "reply" && !(thread?.automation_mode === "human" && thread?.assigned_staff_user_id)) return;
    if (action === "schedule" && !(thread?.automation_mode === "human" && thread?.assigned_staff_user_id)) return;
    if (!selectedId || (action === "reply" && !reply.trim() && !attachment) || (action === "schedule" && !reply.trim())) return;
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
          if (action === "schedule") form.set("scheduledAt", new Date(scheduleAt).toISOString());
          return form;
        })()
        : JSON.stringify({ action, threadId: selectedId, body: replyBody, scheduledAt: action === "schedule" ? new Date(scheduleAt).toISOString() : undefined });
      await supportRequest("", {
        method: "POST",
        body: requestBody,
      });
      if (action === "close") {
        selectedRef.current = ""; setSelectedId("");
        setThread(null);
        const url = new URL(window.location.href);
        url.searchParams.delete("whatsapp");
        window.history.replaceState({}, "", url);
      } else if (action === "reopen") {
        setView("active");
        await loadThread(selectedId);
      } else {
        await loadThread(selectedId);
        setPendingReply(null);
        setAttachment(null);
      }
      await load(true); window.dispatchEvent(new Event("adoce-support-updated"));
      setNotice(action === "takeover" ? "Você assumiu a conversa. Robô pausado." : action === "resume" ? "Conversa devolvida ao robô. O histórico foi preservado." : action === "close" ? "Atendimento encerrado e automação liberada." : action === "reopen" ? "Conversa reaberta. Você pode responder pelo número oficial." : action === "schedule" ? "Mensagem programada pelo número oficial." : "Resposta enviada pelo número oficial.");
      if (action === "schedule") setReply("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível concluir a ação.");
      if (action === "reply") {
        setReply(replyBody);
        setPendingReply(null);
      }
    } finally {
      setBusy(false);
    }
  };

  const startConversation = async () => {
    if (!startPhone.trim() || !startBody.trim()) return;
    setBusy(true);
    try {
      const payload = await supportRequest("", {
        method: "POST",
        body: JSON.stringify({ action: "start", phone: startPhone, body: startBody.trim() }),
      });
      const nextThreadId = String(payload.threadId || "");
      setStartBody("");
      setStartOpen(false);
      setView("active");
      await load(true);
      if (UUID.test(nextThreadId)) await selectThread(nextThreadId);
      const url = new URL(window.location.href);
      url.searchParams.delete("whatsappStart");
      if (UUID.test(nextThreadId)) url.searchParams.set("whatsapp", nextThreadId);
      window.history.replaceState({}, "", url);
      window.dispatchEvent(new Event("adoce-support-updated"));
      setNotice("Conversa iniciada pelo número oficial.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível iniciar a conversa.");
    } finally {
      setBusy(false);
    }
  };

  const cancelScheduled = async (messageId: string) => {
    if (!selectedId) return;
    setBusy(true);
    try {
      await supportRequest("", {
        method: "POST",
        body: JSON.stringify({ action: "cancelScheduled", threadId: selectedId, scheduledMessageId: messageId }),
      });
      await loadThread(selectedId);
      await load(true);
      setNotice("Mensagem programada cancelada.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível cancelar a mensagem.");
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
    () => threads.filter((item) => item.status === "waiting" && item.automation_mode !== "bot").length,
    [threads],
  );
  const visibleThreads = useMemo(() => threads.filter((item) =>
    !search.trim() || item.phone_last4.includes(search.trim()) ||
    (item.phone_e164 || "").includes(search.replace(/\D/g, "") || "#") ||
    (item.customer_name || "").toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")) ||
    (item.last_message || "").toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR"))
  ), [threads, search]);

  return (
    <section className="whatsapp-support" aria-labelledby="whatsapp-support-title">
      <header className="whatsapp-support-heading">
        <div>
          <span>WhatsApp oficial</span>
          <h2 id="whatsapp-support-title">Conversas com clientes</h2>
          <p>Acompanhe o robô e consulte as conversas encerradas quando precisar.</p>
        </div>
        <button type="button" onClick={() => setStartOpen((current) => !current)} disabled={busy}>
          <MessageCircle /> Nova conversa
        </button>
        <button type="button" onClick={() => void load()} disabled={loading}>
          <RefreshCw /> {loading ? "Atualizando…" : "Atualizar"}
        </button>
      </header>

      {notice ? <p className="whatsapp-support-notice" role="status">{notice}</p> : null}
      {startOpen ? (
        <form className="whatsapp-support-start" onSubmit={(event) => { event.preventDefault(); void startConversation(); }}>
          <label>
            WhatsApp do cliente
            <input inputMode="tel" value={startPhone} onChange={(event) => setStartPhone(event.target.value)} placeholder="(85) 99999-0000" />
          </label>
          <label>
            Primeira mensagem
            <textarea value={startBody} maxLength={4000} rows={3} onChange={(event) => setStartBody(event.target.value)} placeholder="Escreva a mensagem que será enviada pelo número oficial" />
          </label>
          <button type="submit" disabled={busy || !startPhone.trim() || !startBody.trim()}>
            <Send /> {busy ? "Enviando…" : "Iniciar conversa"}
          </button>
        </form>
      ) : null}
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
        <aside className="whatsapp-support-list" aria-label={view === "history" ? "Histórico de conversas" : "Conversas em atendimento"}>
          <div className="whatsapp-support-list-title">
            <strong>{view === "history" ? "Histórico de conversas" : `${threads.filter(item => item.has_customer_messages).length} conversas com clientes`}</strong>
            {waitingCount ? <span>{waitingCount} aguardando</span> : null}
          </div>
          <div className="whatsapp-support-list-controls">
            <button type="button" aria-pressed={view === "active"} onClick={() => { setView("active"); setSearch(""); }}>Em atendimento</button>
            <button type="button" aria-pressed={view === "history"} onClick={() => { setView("history"); setSearch(""); }}>Histórico</button>
            <input aria-label="Buscar conversa por nome, telefone ou mensagem" placeholder="Buscar nome, telefone ou mensagem" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          {!loading && !notice && !visibleThreads.length ? (
            <p className="whatsapp-support-empty">{search ? "Nenhuma conversa corresponde à busca." : view === "history" ? "Nenhuma conversa encerrada registrada." : "Nenhum cliente aguardando agora."}</p>
          ) : null}
          {visibleThreads.map((item) => (
            <button
              type="button"
              key={item.id}
              className={selectedId === item.id ? "is-selected" : ""}
              onClick={() => void selectThread(item.id)}
            >
              <MessageCircle />
              <span>
                <strong>{item.customer_name || contactPhoneLabel(item)}</strong>
                <small>{item.customer_name ? `${contactPhoneLabel(item)} · ` : ""}{departmentLabel(item.department)} · {item.status === "closed" ? "Encerrada" : !item.has_customer_messages ? "Somente avisos do pedido" : item.automation_mode === "bot" ? "Com o robô" : item.assigned_staff_user_id ? "Com a equipe" : "Aguardando equipe"}</small>
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
              <p>Escolha uma conversa para ver o histórico completo. Não é preciso assumir para acompanhar.</p>
            </div>
          ) : (
            <>
              <header>
                {attachment ? <div className="whatsapp-support-attachment"><span>{attachment.name}</span><button type="button" onClick={() => setAttachment(null)} aria-label="Remover anexo"><X /></button></div> : null}
                <div>
                  <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*,application/pdf" hidden onChange={(event) => setAttachment(event.target.files?.[0] || null)} />
                  <button type="button" className="whatsapp-support-icon-button" onClick={() => fileInputRef.current?.click()} aria-label="Anexar foto, vídeo ou documento"><Paperclip /></button>
                  <strong>{thread.customer_name || contactPhoneLabel(thread)}</strong>
                  <small>{thread.customer_name ? `${contactPhoneLabel(thread)} · ` : ""}{departmentLabel(thread.department)} · responde pelo número oficial</small>
                </div>
                {thread.status === "closed" ? <button type="button" onClick={() => void act("reopen")} disabled={busy}>
                  <RotateCcw /> Reabrir conversa
                </button> : null}
                {thread.status !== "closed" ? <button type="button" onClick={() => void act("takeover")} disabled={busy || Boolean(thread.automation_mode === "human" && thread.assigned_staff_user_id)}>
                  <CheckCircle2 /> Assumir conversa
                </button> : null}
                {thread.status !== "closed" && thread.automation_mode === "human" && thread.assigned_staff_user_id ? <button type="button" onClick={() => void act("resume")} disabled={busy}>Devolver ao robô</button> : null}
                {thread.status !== "closed" ? <button type="button" onClick={() => void act("close")} disabled={busy}>Encerrar chat</button> : null}
              </header>
              {!thread.messages.some(message => message.direction === "inbound") ? <p className="whatsapp-support-notice">Ainda não há mensagens recebidas deste cliente registradas. Abaixo estão os avisos disponíveis do pedido.</p> : null}
              <div onScroll={() => { const list=messageListRef.current; if(list) nearBottomRef.current=list.scrollHeight-list.scrollTop-list.clientHeight < 90; }} ref={messageListRef} className="whatsapp-support-messages" aria-live="polite">
                {[...(thread.messages || []), ...(pendingReply ? [pendingReply] : [])].map((message) => (
                  <article key={message.id} className={`is-${message.direction}`}>
                    <strong>{message.author_kind === "bot" ? "Robô Adoce" : message.direction === "inbound" ? "Cliente" : message.direction === "system" ? "Registro do atendimento" : "Equipe Adoce"}</strong>
                    {message.media_url && message.media_kind === "image" ? <img className="whatsapp-support-media-image" src={message.media_url} alt={message.media_filename || "Imagem recebida"} loading="lazy" /> : null}
                    {message.media_url && message.media_kind === "video" ? <video className="whatsapp-support-media-video" src={message.media_url} controls preload="metadata" /> : null}
                    {message.media_url && message.media_kind === "audio" ? <audio className="whatsapp-support-media-audio" src={message.media_url} controls preload="metadata" /> : null}
                    {message.media_url && message.media_kind === "document" ? <a className="whatsapp-support-media-document" href={message.media_url} target="_blank" rel="noreferrer">Abrir {message.media_filename || "documento"}</a> : null}
                    <p>{message.body}</p>
                    <time>{pendingReply?.id === message.id ? "Enviando…" : new Intl.DateTimeFormat("pt-BR", { day:"2-digit",month:"2-digit",hour: "2-digit", minute: "2-digit" }).format(new Date(message.created_at))}</time>
                  </article>
                ))}
              </div>
              {thread.scheduled_messages?.length ? (
                <section className="whatsapp-support-scheduled" aria-label="Mensagens programadas">
                  <strong>Mensagens programadas</strong>
                  {thread.scheduled_messages.map((scheduled) => (
                    <article key={scheduled.id}>
                      <span>
                        <CalendarClock />
                        <b>{new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(scheduled.scheduled_at))}</b>
                        <small>{scheduled.status === "failed" ? "Falhou" : scheduled.status === "processing" ? "Enviando" : "Pendente"}</small>
                      </span>
                      <p>{scheduled.body}</p>
                      {scheduled.last_error ? <small>{scheduled.last_error}</small> : null}
                      {scheduled.status === "pending" ? <button type="button" onClick={() => void cancelScheduled(scheduled.id)} disabled={busy}><Trash2 /> Cancelar</button> : null}
                    </article>
                  ))}
                </section>
              ) : null}
              {thread.status === "closed" ? <p className="whatsapp-support-notice">Conversa encerrada. O histórico permanece disponível para consulta. Use Reabrir conversa para responder novamente.</p> : <form onSubmit={(event) => { event.preventDefault(); void act("reply"); }}>
                <label htmlFor="whatsapp-support-reply">Responder pelo WhatsApp oficial</label>
                {!(thread.automation_mode === "human" && thread.assigned_staff_user_id) ? <p>O robô está atendendo. Assuma a conversa para enviar sua resposta.</p> : null}
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
                  <button type="submit" disabled={busy || !(thread.automation_mode === "human" && thread.assigned_staff_user_id) || (!reply.trim() && !attachment)}>
                    <Send /> {busy ? "Enviando…" : "Enviar"}
                  </button>
                </div>
                <div className="whatsapp-support-schedule-row">
                  <label htmlFor="whatsapp-support-schedule">Programar envio</label>
                  <input id="whatsapp-support-schedule" type="datetime-local" value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} />
                  <button type="button" onClick={() => void act("schedule")} disabled={busy || !(thread.automation_mode === "human" && thread.assigned_staff_user_id) || !reply.trim() || Boolean(attachment)}>
                    <CalendarClock /> Agendar
                  </button>
                </div>
                <button type="button" className={`whatsapp-support-record-button${recording ? " is-recording" : ""}`} onClick={() => recording ? stopRecording() : void startRecording()} disabled={busy}>
                  {recording ? <Square /> : <Mic />} {recording ? "Parar gravação" : "Gravar áudio"}
                </button>
              </form>}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
