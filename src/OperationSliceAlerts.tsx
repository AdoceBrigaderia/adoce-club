import { useCallback, useEffect, useMemo, useState } from "react";
import { BellRing, Check, MessageCircle, RefreshCw } from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import "./operation-slice-alerts.css";

type AlertRow = { id: string; flavor_id: string; first_name: string; last_name: string; phone_e164: string; status: "waiting" | "queued" | "sent" | "cancelled"; queued_at: string | null; sent_at: string | null; flavors: { name: string } | null };

export default function OperationSliceAlerts() {
  const [items, setItems] = useState<AlertRow[]>([]);
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    const { data, error } = await requireSupabase().from("slice_availability_alerts")
      .select("id,flavor_id,first_name,last_name,phone_e164,status,queued_at,sent_at,flavors(name)")
      .in("status", ["waiting", "queued"]).order("queued_at", { ascending: false, nullsFirst: false });
    if (error) { setNotice("Os avisos ainda não puderam ser carregados."); return; }
    setItems((data || []) as unknown as AlertRow[]); setNotice("");
  }, []);
  useEffect(() => { void load(); }, [load]);
  const queued = useMemo(() => items.filter((item) => item.status === "queued"), [items]);
  const waiting = items.length - queued.length;
  const send = async (item: AlertRow) => {
    const flavorName = item.flavors?.name || "sua fatia favorita";
    const cartUrl = `${location.origin}${location.pathname}#carrinho?flavor=${encodeURIComponent(item.flavor_id)}`;
    const message = `Olá, ${item.first_name}! A fatia ${flavorName} já está disponível para retirada no Cantinho Adoce. Escolha a calda e finalize seu pedido aqui: ${cartUrl}`;
    window.open(`https://wa.me/${item.phone_e164.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
    const { error } = await requireSupabase().from("slice_availability_alerts").update({ status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", item.id).eq("status", "queued");
    if (error) { setNotice("O WhatsApp abriu, mas não foi possível marcar o aviso como enviado."); return; }
    setItems((current) => current.filter((row) => row.id !== item.id));
  };
  return <section className="operation-slice-alerts">
    <header><div><small>Lista de interesse</small><h3><BellRing /> Avisos de fatias</h3><p>{queued.length} pronto(s) para avisar · {waiting} aguardando disponibilidade</p></div><button type="button" onClick={() => void load()}><RefreshCw /> Atualizar</button></header>
    {notice ? <p role="alert">{notice}</p> : null}
    {queued.length ? <div>{queued.map((item) => <article key={item.id}><span><strong>{item.first_name} {item.last_name}</strong><small>{item.flavors?.name || "Fatia"}</small></span><button type="button" onClick={() => void send(item)}><MessageCircle /> Abrir mensagem pronta</button></article>)}</div> : <div className="operation-slice-alerts-empty"><Check /><span>Nenhum aviso pronto para envio.</span></div>}
  </section>;
}

