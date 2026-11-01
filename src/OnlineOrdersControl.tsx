import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Clock3, MapPin, MessageCircle, Power, Save, Eye } from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import { serviceState, type BusinessHour, type BusinessHourException } from "./AdoceHoje";
import { serviceStatusMessage } from "./service-status";
import "./online-orders-control.css";

const WEEKDAY_MAP: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const weekdayHoje = () => {
  const value = new Intl.DateTimeFormat("en-US", { timeZone: "America/Fortaleza", weekday: "short" }).format(new Date());
  return WEEKDAY_MAP[value] ?? 0;
};
const dataHojeExtenso = () =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", weekday: "long", day: "2-digit", month: "long" }).format(new Date());
const hhmm = (value: string | null) => (value || "").slice(0, 5);
const somaDias = (data: string, dias: number) => {
  const resultado = new Date(`${data}T12:00:00Z`);
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return resultado.toISOString().slice(0, 10);
};
const rotuloData = (data: string, hoje: string) => {
  if (data === hoje) return "hoje";
  if (data === somaDias(hoje, 1)) return "amanhã";
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
};

// Pedido do proprietário em 01/11/2026: ligar/desligar pedidos online,
// escrever a mensagem que o cliente vê e escolher o horário de hoje, tudo
// direto no painel "Hoje" -- sem precisar ir em Produtos > Horários e
// canais. Usa exatamente as mesmas tabelas e a mesma lógica de mensagem
// (serviceState/serviceStatusMessage) que a própria tela do cliente usa,
// pra prévia nunca mentir sobre o que vai aparecer lá.
const SLUG = "online_orders";
const todayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date());

type ChannelState = { status: string; message: string | null; pickup_location_slug: string | null };
type PickupLocation = { slug: string; name: string; address_text: string | null };

// Pedido do proprietário em 01/11/2026: duas mensagens prontas (uma por
// local de retirada), além da mensagem livre -- escolher uma pronta também
// muda o local de retirada gravado nos pedidos de hoje, pra mensagem e
// local nunca ficarem desencontrados como estavam antes.
const MESSAGE_PRESETS: { key: string; locationSlug: string; text: string }[] = [
  {
    key: "fabrica",
    locationSlug: "portao-adoce",
    text: "Reserve agora — retirada a partir das 14:00, na Adoce Fábrica - Rua Professor Odílio Filho, 227 - Passaré - Fortaleza/CE.",
  },
  {
    key: "barraca",
    locationSlug: "cantinho-da-adoce",
    text: "Reserve agora — retirada a partir das 18:00, na Adoce Barraca - Av. da Saudade Sem Numero, em frente ao condomínio Reserva dos Ipês - Passaré - Fortaleza/CE.",
  },
];

export default function OnlineOrdersControl() {
  const [channel, setChannel] = useState<ChannelState | null>(null);
  const [hours, setHours] = useState<BusinessHour[]>([]);
  const [exceptions, setExceptions] = useState<BusinessHourException[]>([]);
  const [locations, setLocations] = useState<PickupLocation[]>([]);
  const [draftLocationSlug, setDraftLocationSlug] = useState("cantinho-da-adoce");
  const [draftMessage, setDraftMessage] = useState("");
  const [useTimeToday, setUseTimeToday] = useState(false);
  const [opensAt, setOpensAt] = useState("09:00");
  const [closesAt, setClosesAt] = useState("20:00");
  const [timeNote, setTimeNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const today = todayKey();
  // Pedido do proprietário em 01/11/2026: o horário especial não pode ser só
  // "de hoje" -- precisa dar pra preparar amanhã (feriado) ou um domingo
  // futuro com antecedência, sem precisar voltar nesse painel no dia exato.
  const [selectedDate, setSelectedDate] = useState(today);

  const load = useCallback(async () => {
    const supabase = requireSupabase();
    const [channelResult, hoursResult, exceptionsResult, locationsResult] = await Promise.all([
      supabase.from("store_channels").select("status,message,pickup_location_slug").eq("slug", SLUG).maybeSingle(),
      supabase.from("business_hours").select("channel_slug,weekday,opens_at,closes_at,active,note").eq("channel_slug", SLUG),
      supabase.from("business_hour_exceptions").select("channel_slug,service_date,closed,opens_at,closes_at,message").eq("channel_slug", SLUG),
      supabase.from("pickup_locations").select("slug,name,address_text").eq("active", true).order("sort_order"),
    ]);
    setLoading(false);
    if (channelResult.error) { setNotice(channelResult.error.message); return; }
    setLocations((locationsResult.data || []) as PickupLocation[]);
    if (channelResult.data) {
      setChannel(channelResult.data as ChannelState);
      setDraftMessage(channelResult.data.message || "");
      setDraftLocationSlug(channelResult.data.pickup_location_slug || "cantinho-da-adoce");
    }
    setHours((hoursResult.data || []) as BusinessHour[]);
    setExceptions((exceptionsResult.data || []) as BusinessHourException[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Troca de data no seletor (ou chegada dos dados) -- preenche os campos
  // com a exceção já salva pra aquele dia, se existir, em vez de sempre
  // assumir "hoje".
  useEffect(() => {
    const existente = exceptions.find((item) => item.service_date === selectedDate);
    if (existente) {
      setUseTimeToday(!existente.closed);
      setOpensAt(hhmm(existente.opens_at) || "09:00");
      setClosesAt(hhmm(existente.closes_at) || "20:00");
      setTimeNote(existente.message || "");
    } else {
      setUseTimeToday(false);
      setOpensAt("09:00");
      setClosesAt("20:00");
      setTimeNote("");
    }
  }, [selectedDate, exceptions]);

  // A confirmação some sozinha depois de um tempo, pra não ficar uma frase
  // velha na tela parecendo que ainda vale pro que está sendo editado agora.
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const toggleOnline = async () => {
    if (!channel) return;
    setBusy(true);
    setNotice("");
    // "closed" é o valor usado em todo o resto do sistema (inclusive na tela
    // de Produtos > Horários e canais) pra dizer "segue o horário cadastrado"
    // -- "scheduled" não existe no enum channel_status e fazia esse toggle
    // falhar ao tentar ligar de volta.
    const nextStatus = channel.status === "paused" ? "closed" : "paused";
    const { error } = await requireSupabase().from("store_channels").update({ status: nextStatus }).eq("slug", SLUG);
    setBusy(false);
    if (error) return setNotice(error.message);
    setChannel({ ...channel, status: nextStatus });
    setNotice(nextStatus === "paused" ? "Pedidos online pausados." : "Pedidos online retomados, seguindo o horário cadastrado.");
  };

  const saveMessage = async () => {
    setBusy(true);
    setNotice("");
    const { error } = await requireSupabase()
      .from("store_channels")
      .update({ message: draftMessage.trim() || null, pickup_location_slug: draftLocationSlug })
      .eq("slug", SLUG);
    setBusy(false);
    if (error) return setNotice(error.message);
    setChannel((current) => (current ? { ...current, message: draftMessage.trim() || null, pickup_location_slug: draftLocationSlug } : current));
    setNotice("Mensagem e local de retirada atualizados.");
  };

  const applyPreset = (preset: (typeof MESSAGE_PRESETS)[number]) => {
    setDraftMessage(preset.text);
    setDraftLocationSlug(preset.locationSlug);
  };

  const saveTime = async () => {
    setBusy(true);
    setNotice("");
    const rotulo = rotuloData(selectedDate, today);
    if (!useTimeToday) {
      const { error } = await requireSupabase().from("business_hour_exceptions").delete().eq("channel_slug", SLUG).eq("service_date", selectedDate);
      setBusy(false);
      if (error) return setNotice(error.message);
      setExceptions((current) => current.filter((item) => item.service_date !== selectedDate));
      setNotice(`Horário de ${rotulo} voltou a seguir o padrão cadastrado em Produtos > Horários e canais.`);
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(opensAt) || !/^\d{2}:\d{2}$/.test(closesAt)) {
      setBusy(false);
      return setNotice(`Informe os dois horários de ${rotulo}.`);
    }
    const row = { channel_slug: SLUG, service_date: selectedDate, closed: false, opens_at: opensAt, closes_at: closesAt, message: timeNote.trim() || null };
    const { error } = await requireSupabase().from("business_hour_exceptions").upsert(row, { onConflict: "channel_slug,service_date" });
    setBusy(false);
    if (error) return setNotice(error.message);
    setExceptions((current) => [...current.filter((item) => item.service_date !== selectedDate), row]);
    setNotice(`Horário de ${rotulo} salvo.`);
  };

  // Prévia ao vivo: usa a MESMA conta que a tela do cliente usa (inclusive
  // o que ainda não foi salvo), pra nunca prometer algo que não é real.
  const draftExceptions = useMemo(() => {
    const withoutSelected = exceptions.filter((item) => item.service_date !== selectedDate);
    if (!useTimeToday) return withoutSelected;
    return [...withoutSelected, { channel_slug: SLUG, service_date: selectedDate, closed: false, opens_at: opensAt, closes_at: closesAt, message: timeNote.trim() || null }];
  }, [exceptions, useTimeToday, opensAt, closesAt, timeNote, selectedDate]);
  const paused = channel?.status === "paused";
  const pickupState = serviceState("pickup", hours, draftExceptions);
  const previewMessage = serviceStatusMessage({
    open: paused ? false : pickupState.open,
    paused,
    channelMessage: draftMessage,
    scheduleMessage: pickupState.message,
    pausedMessage: "Retiradas pausadas no momento.",
  });

  // O que está DE FATO em produção agora -- usa o que já foi salvo
  // (channel.message, exceptions sem o rascunho), nunca o que ainda está
  // sendo editado, pra nunca confundir "o que vai mudar" com "o que o
  // cliente já está vendo".
  const savedPickupState = serviceState("pickup", hours, exceptions);
  const liveMessage = channel
    ? serviceStatusMessage({
        open: paused ? false : savedPickupState.open,
        paused,
        channelMessage: channel.message,
        scheduleMessage: savedPickupState.message,
        pausedMessage: "Retiradas pausadas no momento.",
      })
    : "";
  const liveLocation = locations.find((l) => l.slug === channel?.pickup_location_slug);

  // Horário explícito de hoje (números, não só a frase) -- pedido do
  // proprietário em 01/11/2026: ver exatamente que horário o site está
  // aceitando pedidos agora, sem precisar interpretar texto.
  const horarioHojeTexto = useMemo(() => {
    const excecaoHoje = exceptions.find((item) => item.service_date === today);
    if (excecaoHoje) {
      return excecaoHoje.closed ? "Fechado hoje (exceção cadastrada)" : `${hhmm(excecaoHoje.opens_at)} às ${hhmm(excecaoHoje.closes_at)} (exceção de hoje)`;
    }
    const recorrentesHoje = hours.filter((item) => item.active && item.weekday === weekdayHoje());
    if (!recorrentesHoje.length) return "Sem horário cadastrado para hoje";
    return recorrentesHoje.map((item) => `${hhmm(item.opens_at)} às ${hhmm(item.closes_at)}`).join(" · ");
  }, [exceptions, hours, today]);

  const online = !paused;

  return (
    <section className="online-orders-control">
      <header>
        <div>
          <small>Pedidos online · {dataHojeExtenso()}</small>
          <h2>{loading ? "Carregando…" : online ? "Ligado" : "Pausado"}</h2>
          {!loading ? <p className="online-orders-hours-badge"><Clock3 /> {horarioHojeTexto}</p> : null}
        </div>
        <button type="button" className={online ? "online-toggle is-on" : "online-toggle is-off"} onClick={() => void toggleOnline()} disabled={busy || !channel}>
          <Power /> {online ? "Pausar pedidos online" : "Retomar pedidos online"}
        </button>
      </header>

      {notice ? <p className="online-orders-notice" role="status"><Check /> {notice}</p> : null}

      <details className="online-orders-live" open>
        <summary><Eye /> Em produção agora — o que o cliente está recebendo</summary>
        <p className="online-orders-live-message">{loading ? "Carregando…" : liveMessage || "Nenhuma mensagem definida."}</p>
        <dl>
          <div><dt>Local de retirada</dt><dd>{liveLocation?.name || channel?.pickup_location_slug || "—"}</dd></div>
          <div><dt>Horário aceitando pedidos hoje</dt><dd>{paused ? "Pausado manualmente" : horarioHojeTexto}</dd></div>
        </dl>
      </details>

      <div className="online-orders-field">
        <span><MapPin /> Local de retirada de hoje</span>
        <select
          className="online-orders-location-select"
          value={draftLocationSlug}
          onChange={(e) => setDraftLocationSlug(e.target.value)}
          disabled={busy}
        >
          {locations.map((location) => (
            <option key={location.slug} value={location.slug}>{location.name}</option>
          ))}
        </select>

        <span><MessageCircle /> Mensagem para quem acessar o pedido <small>{draftMessage.length}/160</small></span>
        <div className="online-orders-preset-list">
          {MESSAGE_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              className={draftMessage === preset.text ? "online-orders-preset-card is-selected" : "online-orders-preset-card"}
              onClick={() => applyPreset(preset)}
              disabled={busy}
            >
              <strong>{locations.find((l) => l.slug === preset.locationSlug)?.name || preset.locationSlug}</strong>
              <span>{preset.text}</span>
            </button>
          ))}
        </div>
        <textarea
          className="online-orders-message-box"
          maxLength={160}
          rows={2}
          placeholder="Ex.: Hoje só recebemos pedidos até às 18h."
          value={draftMessage}
          onChange={(e) => setDraftMessage(e.target.value)}
          disabled={busy}
        />
        <small className="online-orders-hint">Só aparece pro cliente com os pedidos ligados e dentro do horário de hoje. Escolher uma mensagem pronta já ajusta o local acima junto.</small>
        <button type="button" className="online-orders-primary" onClick={() => void saveMessage()} disabled={busy}><Save /> Salvar mensagem e local</button>
      </div>

      <div className="online-orders-field">
        <span><Clock3 /> Horário especial -- qualquer dia, não só hoje</span>
        <div className="online-orders-date-chips">
          <button type="button" className={selectedDate === today ? "is-selected" : ""} onClick={() => setSelectedDate(today)} disabled={busy}>Hoje</button>
          <button type="button" className={selectedDate === somaDias(today, 1) ? "is-selected" : ""} onClick={() => setSelectedDate(somaDias(today, 1))} disabled={busy}>Amanhã</button>
          <input type="date" min={today} value={selectedDate} onChange={(e) => setSelectedDate(e.target.value || today)} disabled={busy} />
        </div>
        <div className="online-orders-time-row">
          <input type="checkbox" checked={useTimeToday} onChange={(e) => setUseTimeToday(e.target.checked)} disabled={busy} aria-label={`Definir horário especial para ${rotuloData(selectedDate, today)}`} />
          <input type="time" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} disabled={busy || !useTimeToday} />
          <span>até</span>
          <input type="time" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} disabled={busy || !useTimeToday} />
        </div>
        {useTimeToday ? (
          <input
            className="online-orders-time-note"
            type="text"
            placeholder="Mensagem do horário (opcional)"
            maxLength={160}
            value={timeNote}
            onChange={(e) => setTimeNote(e.target.value)}
            disabled={busy}
          />
        ) : null}
        <button type="button" className="online-orders-primary" onClick={() => void saveTime()} disabled={busy}><Save /> Salvar horário de {rotuloData(selectedDate, today)}</button>
      </div>

      <details className="online-orders-preview">
        <summary><Eye /> Pré-visualização de hoje (com o que ainda não foi salvo)</summary>
        <p>{previewMessage}</p>
        {selectedDate !== today ? <small className="online-orders-hint">O horário especial que você está editando é de {rotuloData(selectedDate, today)} -- essa prévia só mostra hoje.</small> : null}
      </details>
    </section>
  );
}
