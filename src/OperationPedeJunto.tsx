import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Clock3, ExternalLink, MessageCircle, PackageCheck, RefreshCw, Users, X } from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import { money } from "./commercial";
import "./operation-pede-junto.css";

type Item = { id: string; flavor_name: string; quantity: number; unit_price: number; status: string };
type Participant = { id: string; name: string; phone_e164: string; status: string; payment_url: string | null; payment_expires_at: string | null; pede_junto_items: Item[] };
type Group = { id: string; public_code: string; name: string; organizer_name: string; organizer_phone: string; delivery_address: string; delivery_reference: string | null; status: string; closes_at: string; created_at: string; pede_junto_participants: Participant[] };

const groupLabels: Record<string, string> = {
  open: "Grupo aberto", submitted: "Aguardando conferência", confirmed: "Separado",
  awaiting_payment: "Aguardando pagamentos", preparing: "Em preparação", ready: "Pronto",
  completed: "Concluído", cancelled: "Cancelado", expired: "Expirado",
};
const participantLabels: Record<string, string> = {
  active: "Escolhendo", payment_pending: "Aguardando pagamento", paid: "Pago", removed: "Removido", cancelled: "Cancelado",
};
const dateTime = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Fortaleza" }).format(new Date(value));
const digits = (value: string) => value.replace(/\D/g, "");

export default function OperationPedeJunto() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [paymentDrafts, setPaymentDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setBusy(true);
    const { data, error } = await requireSupabase().from("pede_junto_groups").select("*,pede_junto_participants(*,pede_junto_items(*))").order("created_at", { ascending: false }).limit(100);
    setBusy(false);
    if (error) { setNotice(error.message); return; }
    const next = (data || []) as unknown as Group[];
    setGroups(next);
    setSelectedId((current) => current || next[0]?.id || "");
    setPaymentDrafts(Object.fromEntries(next.flatMap((group) => group.pede_junto_participants.map((participant) => [participant.id, participant.payment_url || ""]))));
  }, []);

  useEffect(() => { void load(); }, [load]);
  const selected = groups.find((group) => group.id === selectedId) || null;
  const totalSlices = (group: Group) => group.pede_junto_participants.filter((participant) => !["removed", "cancelled"].includes(participant.status)).flatMap((participant) => participant.pede_junto_items).filter((item) => item.status !== "cancelled").reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = (group: Group) => group.pede_junto_participants.filter((participant) => !["removed", "cancelled"].includes(participant.status)).flatMap((participant) => participant.pede_junto_items).filter((item) => item.status !== "cancelled").reduce((sum, item) => sum + item.quantity * Number(item.unit_price), 0);
  const activeGroups = useMemo(() => groups.filter((group) => !["completed", "cancelled", "expired"].includes(group.status)), [groups]);

  const updateParticipant = async (participant: Participant, status: string) => {
    if (status === "removed" && !window.confirm(`Remover as fatias de ${participant.name} deste grupo?`)) return;
    setBusy(true);
    const paymentUrl = paymentDrafts[participant.id]?.trim() || null;
    const expires = status === "payment_pending" && paymentUrl ? new Date(Date.now() + 20 * 60_000).toISOString() : null;
    const { error } = await requireSupabase().rpc("staff_update_pede_junto_participant", { target_participant_id: participant.id, next_status: status, next_payment_url: paymentUrl, next_payment_expires_at: expires });
    setBusy(false);
    setNotice(error ? error.message : `${participant.name}: ${participantLabels[status]}.`);
    if (!error) await load();
  };

  const updateGroup = async (status: string) => {
    if (!selected) return;
    if (["completed", "cancelled"].includes(status) && !window.confirm(`Marcar “${selected.name}” como ${groupLabels[status].toLowerCase()}?`)) return;
    setBusy(true);
    const { error } = await requireSupabase().rpc("staff_update_pede_junto_group", { target_group_id: selected.id, next_status: status });
    setBusy(false);
    setNotice(error ? error.message : `Grupo atualizado: ${groupLabels[status]}.`);
    if (!error) await load();
  };

  const paymentMessage = (participant: Participant) => {
    const url = paymentDrafts[participant.id] || participant.payment_url || "";
    const first = participant.name.split(/\s+/)[0];
    return encodeURIComponent(`Oi, ${first}! 🍰 Sua fatia no Pede Junto Adoce foi separada. Agora é só concluir o seu pagamento pelo link abaixo. O link fica reservado por 20 minutos:\n\n${url}\n\nCada um paga o seu e todo mundo recebe junto. 💗`);
  };

  return <section className="op-pede-junto">
    <header><div><small>Venda compartilhada</small><h2>Pede Junto Adoce</h2><p>A quinta fatia libera a entrega grátis. Depois disso, o grupo continua crescendo sem limite.</p></div><button onClick={() => void load()} disabled={busy}><RefreshCw /> Atualizar</button></header>
    <div className="op-pede-summary"><span><strong>{activeGroups.length}</strong><small>grupos ativos</small></span><span><strong>{activeGroups.reduce((sum, group) => sum + totalSlices(group), 0)}</strong><small>fatias em andamento</small></span><span><strong>{activeGroups.filter((group) => totalSlices(group) >= 5).length}</strong><small>entregas grátis liberadas</small></span></div>
    {notice ? <p className="op-pede-notice" role="status">{notice}</p> : null}
    <div className="op-pede-layout">
      <div className="op-pede-list">
        {groups.map((group) => <button key={group.id} className={group.id === selectedId ? "active" : ""} onClick={() => setSelectedId(group.id)}><span><small>{group.public_code}</small><strong>{group.name}</strong><em>{group.organizer_name} · {dateTime(group.created_at)}</em></span><b className={totalSlices(group) >= 5 ? "unlocked" : ""}>{totalSlices(group)} fatias</b><i>{groupLabels[group.status] || group.status}</i><ChevronRight /></button>)}
        {!groups.length && !busy ? <p>Nenhum Pede Junto criado ainda.</p> : null}
      </div>
      {selected ? <article className="op-pede-detail">
        <div className="op-pede-detail-head"><div><small>{selected.public_code}</small><h3>{selected.name}</h3><p>{selected.delivery_address}{selected.delivery_reference ? ` · ${selected.delivery_reference}` : ""}</p></div><span className={totalSlices(selected) >= 5 ? "unlocked" : ""}><strong>{totalSlices(selected)}</strong><small>fatias</small></span></div>
        <div className="op-pede-benefit"><PackageCheck /><span><strong>{totalSlices(selected) >= 5 ? "Entrega grátis liberada" : `Faltam ${5 - totalSlices(selected)} para liberar`}</strong><small>O grupo pode receber quantas fatias quiser.</small></span><b>{money(totalValue(selected))}</b></div>
        <div className="op-pede-participants">
          {selected.pede_junto_participants.map((participant) => {
            const amount = participant.pede_junto_items.filter((item) => item.status !== "cancelled").reduce((sum, item) => sum + item.quantity * Number(item.unit_price), 0);
            return <section key={participant.id}><header><span><strong>{participant.name}</strong><small>{participant.phone_e164} · {participantLabels[participant.status] || participant.status}</small></span><b>{money(amount)}</b></header><ul>{participant.pede_junto_items.filter((item) => item.status !== "cancelled").map((item) => <li key={item.id}><span>{item.quantity}× {item.flavor_name}</span><strong>{money(item.quantity * Number(item.unit_price))}</strong></li>)}</ul><label>Link de pagamento individual<input type="url" value={paymentDrafts[participant.id] || ""} onChange={(event) => setPaymentDrafts({ ...paymentDrafts, [participant.id]: event.target.value })} placeholder="Cole o link gerado no Mercado Pago" /></label><div className="op-pede-participant-actions"><button disabled={busy} onClick={() => void updateParticipant(participant, "payment_pending")}><Clock3 /> Salvar e aguardar</button><button className="paid" disabled={busy} onClick={() => void updateParticipant(participant, "paid")}><Check /> Marcar pago</button><button className="remove" disabled={busy} onClick={() => void updateParticipant(participant, "removed")}><X /> Remover</button>{(paymentDrafts[participant.id] || participant.payment_url) ? <a href={`https://wa.me/${digits(participant.phone_e164)}?text=${paymentMessage(participant)}`} target="_blank" rel="noreferrer"><MessageCircle /> Enviar link</a> : null}</div></section>;
          })}
        </div>
        <div className="op-pede-group-actions"><strong>Próxima etapa do grupo</strong><div><button onClick={() => void updateGroup("confirmed")}>Confirmar separação</button><button onClick={() => void updateGroup("awaiting_payment")}>Aguardar pagamentos</button><button onClick={() => void updateGroup("preparing")}>Em preparação</button><button onClick={() => void updateGroup("ready")}>Pronto</button><button className="finish" onClick={() => void updateGroup("completed")}>Concluir</button><button className="cancel" onClick={() => void updateGroup("cancelled")}>Cancelar</button></div></div>
        <a className="op-pede-contact" href={`https://wa.me/${digits(selected.organizer_phone)}`} target="_blank" rel="noreferrer"><ExternalLink /> Falar com o organizador</a>
      </article> : <div className="op-pede-empty"><Users /><p>Escolha um grupo para conferir participantes, estoque e pagamentos.</p></div>}
    </div>
  </section>;
}
