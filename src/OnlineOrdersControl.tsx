import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock3, MessageCircle, Power, Save, Eye } from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import { serviceState, type BusinessHour, type BusinessHourException } from "./AdoceHoje";
import { serviceStatusMessage } from "./service-status";
import "./online-orders-control.css";

// Pedido do proprietário em 01/11/2026: ligar/desligar pedidos online,
// escrever a mensagem que o cliente vê e escolher o horário de hoje, tudo
// direto no painel "Hoje" -- sem precisar ir em Produtos > Horários e
// canais. Usa exatamente as mesmas tabelas e a mesma lógica de mensagem
// (serviceState/serviceStatusMessage) que a própria tela do cliente usa,
// pra prévia nunca mentir sobre o que vai aparecer lá.
const SLUG = "online_orders";
const todayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date());

type ChannelState = { status: string; message: string | null };

export default function OnlineOrdersControl() {
  const [channel, setChannel] = useState<ChannelState | null>(null);
  const [hours, setHours] = useState<BusinessHour[]>([]);
  const [exceptions, setExceptions] = useState<BusinessHourException[]>([]);
  const [draftMessage, setDraftMessage] = useState("");
  const [useTimeToday, setUseTimeToday] = useState(false);
  const [opensAt, setOpensAt] = useState("09:00");
  const [closesAt, setClosesAt] = useState("20:00");
  const [timeNote, setTimeNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const today = todayKey();

  const load = useCallback(async () => {
    const supabase = requireSupabase();
    const [channelResult, hoursResult, exceptionsResult] = await Promise.all([
      supabase.from("store_channels").select("status,message").eq("slug", SLUG).maybeSingle(),
      supabase.from("business_hours").select("channel_slug,weekday,opens_at,closes_at,active,note").eq("channel_slug", SLUG),
      supabase.from("business_hour_exceptions").select("channel_slug,service_date,closed,opens_at,closes_at,message").eq("channel_slug", SLUG),
    ]);
    setLoading(false);
    if (channelResult.error) { setNotice(channelResult.error.message); return; }
    if (channelResult.data) {
      setChannel(channelResult.data as ChannelState);
      setDraftMessage(channelResult.data.message || "");
    }
    setHours((hoursResult.data || []) as BusinessHour[]);
    setExceptions((exceptionsResult.data || []) as BusinessHourException[]);
    const todayException = (exceptionsResult.data || []).find((item) => item.service_date === today) as BusinessHourException | undefined;
    if (todayException) {
      setUseTimeToday(true);
      setOpensAt((todayException.opens_at || "09:00").slice(0, 5));
      setClosesAt((todayException.closes_at || "20:00").slice(0, 5));
      setTimeNote(todayException.message || "");
    } else {
      setUseTimeToday(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggleOnline = async () => {
    if (!channel) return;
    setBusy(true);
    const nextStatus = channel.status === "paused" ? "scheduled" : "paused";
    const { error } = await requireSupabase().from("store_channels").update({ status: nextStatus }).eq("slug", SLUG);
    setBusy(false);
    if (error) return setNotice(error.message);
    setChannel({ ...channel, status: nextStatus });
    setNotice(nextStatus === "paused" ? "Pedidos online pausados." : "Pedidos online retomados, seguindo o horário cadastrado.");
  };

  const saveMessage = async () => {
    setBusy(true);
    const { error } = await requireSupabase().from("store_channels").update({ message: draftMessage.trim() || null }).eq("slug", SLUG);
    setBusy(false);
    if (error) return setNotice(error.message);
    setChannel((current) => (current ? { ...current, message: draftMessage.trim() || null } : current));
    setNotice("Mensagem para o cliente atualizada.");
  };

  const saveTime = async () => {
    setBusy(true);
    if (!useTimeToday) {
      const { error } = await requireSupabase().from("business_hour_exceptions").delete().eq("channel_slug", SLUG).eq("service_date", today);
      setBusy(false);
      if (error) return setNotice(error.message);
      setExceptions((current) => current.filter((item) => item.service_date !== today));
      setNotice("Horário de hoje voltou a seguir o padrão cadastrado em Produtos > Horários e canais.");
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(opensAt) || !/^\d{2}:\d{2}$/.test(closesAt)) {
      setBusy(false);
      return setNotice("Informe os dois horários de hoje.");
    }
    const row = { channel_slug: SLUG, service_date: today, closed: false, opens_at: opensAt, closes_at: closesAt, message: timeNote.trim() || null };
    const { error } = await requireSupabase().from("business_hour_exceptions").upsert(row, { onConflict: "channel_slug,service_date" });
    setBusy(false);
    if (error) return setNotice(error.message);
    setExceptions((current) => [...current.filter((item) => item.service_date !== today), row]);
    setNotice("Horário de hoje salvo.");
  };

  // Prévia ao vivo: usa a MESMA conta que a tela do cliente usa (inclusive
  // o que ainda não foi salvo), pra nunca prometer algo que não é real.
  const draftExceptions = useMemo(() => {
    const withoutToday = exceptions.filter((item) => item.service_date !== today);
    if (!useTimeToday) return withoutToday;
    return [...withoutToday, { channel_slug: SLUG, service_date: today, closed: false, opens_at: opensAt, closes_at: closesAt, message: timeNote.trim() || null }];
  }, [exceptions, useTimeToday, opensAt, closesAt, timeNote, today]);
  const paused = channel?.status === "paused";
  const pickupState = serviceState("pickup", hours, draftExceptions);
  const previewMessage = serviceStatusMessage({
    open: paused ? false : pickupState.open,
    paused,
    channelMessage: draftMessage,
    scheduleMessage: pickupState.message,
    pausedMessage: "Retiradas pausadas no momento.",
  });

  const online = !paused;

  return (
    <section className="online-orders-control">
      <header>
        <div>
          <small>Pedidos online</small>
          <h2>{loading ? "Carregando…" : online ? "Ligado" : "Pausado"}</h2>
        </div>
        <button type="button" className={online ? "online-toggle is-on" : "online-toggle is-off"} onClick={() => void toggleOnline()} disabled={busy || !channel}>
          <Power /> {online ? "Pausar pedidos online" : "Retomar pedidos online"}
        </button>
      </header>

      <label className="online-orders-field">
        <span><MessageCircle /> Mensagem para quem acessar o pedido</span>
        <small className="online-orders-hint">Só aparece pro cliente quando os pedidos estão ligados e dentro do horário de hoje.</small>
        <div>
          <input
            maxLength={160}
            placeholder="Ex.: Hoje só recebemos pedidos até às 18h."
            value={draftMessage}
            onChange={(e) => setDraftMessage(e.target.value)}
            disabled={busy}
          />
          <button type="button" onClick={() => void saveMessage()} disabled={busy}><Save /> Salvar</button>
        </div>
      </label>

      <div className="online-orders-field">
        <span><Clock3 /> Horário de disponibilidade de hoje</span>
        <label className="online-orders-today-toggle">
          <input type="checkbox" checked={useTimeToday} onChange={(e) => setUseTimeToday(e.target.checked)} disabled={busy} />
          Definir um horário só para hoje (em vez do horário cadastrado)
        </label>
        {useTimeToday ? (
          <div className="online-orders-time-row">
            <input type="time" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} disabled={busy} />
            <span>até</span>
            <input type="time" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} disabled={busy} />
            <input
              type="text"
              placeholder="Mensagem do horário (opcional)"
              maxLength={160}
              value={timeNote}
              onChange={(e) => setTimeNote(e.target.value)}
              disabled={busy}
            />
          </div>
        ) : null}
        <button type="button" onClick={() => void saveTime()} disabled={busy}><Save /> Salvar horário de hoje</button>
      </div>

      <div className="online-orders-preview">
        <small><Eye /> Como o cliente vê na tela de pedido agora (com o que ainda não foi salvo)</small>
        <p>{previewMessage}</p>
      </div>

      {notice ? <p className="online-orders-notice" role="status">{notice}</p> : null}
    </section>
  );
}
