import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Clock3, MessageCircle, PackageCheck, RefreshCw, Search, ShoppingCart, X } from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import "./operation-instant-orders.css";

type InstantOrderStatus = "awaiting_confirmation" | "reserved" | "awaiting_payment" | "paid" | "preparing" | "ready" | "completed" | "cancelled" | "expired";
type InstantOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  status: InstantOrderStatus;
  payment_status: string;
  checkout_mode: string;
  total: number;
  payment_url: string | null;
  payment_expires_at: string | null;
  reserved_until: string | null;
  pickup_label: string;
  pickup_address: string;
  internal_notes: string;
  created_at: string;
  instant_order_items: Array<{ id: string; flavor_name: string; quantity: number; unit_price: number; status: string }>;
};

const labels: Record<InstantOrderStatus, string> = {
  awaiting_confirmation: "Conferir disponibilidade",
  reserved: "Reservado",
  awaiting_payment: "Aguardando pagamento",
  paid: "Pago",
  preparing: "Em separação",
  ready: "Pronto para retirada",
  completed: "Entregue",
  cancelled: "Cancelado",
  expired: "Prazo encerrado",
};
const money = (value: number) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Fortaleza" }).format(new Date(value));

export default function OperationInstantOrders() {
  const [orders, setOrders] = useState<InstantOrder[]>([]);
  const [selected, setSelected] = useState<InstantOrder | null>(null);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    const { data, error } = await requireSupabase().from("instant_orders")
      .select("*,instant_order_items(id,flavor_name,quantity,unit_price,status)")
      .order("created_at", { ascending: false }).limit(300);
    setBusy(false);
    if (error) return setNotice(error.message);
    setOrders((data || []) as InstantOrder[]);
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const supabase = requireSupabase();
    const channel = supabase.channel("operation-instant-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "instant_orders" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  const openOrder = (order: InstantOrder) => {
    setSelected(order);
    setPaymentUrl(order.payment_url || "");
    setInternalNotes(order.internal_notes || "");
    setNotice("");
  };

  const update = async (status: InstantOrderStatus, reason = "") => {
    if (!selected) return;
    setBusy(true);
    const { error } = await requireSupabase().rpc("staff_update_instant_order", {
      target_order_id: selected.id,
      next_status: status,
      next_payment_url: paymentUrl || null,
      next_payment_expires_at: status === "awaiting_payment" ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null,
      next_internal_notes: internalNotes,
      next_cancellation_reason: reason || null,
    });
    setBusy(false);
    if (error) return setNotice(error.message);
    setNotice(`${selected.order_number}: ${labels[status].toLocaleLowerCase("pt-BR")}.`);
    setSelected(null);
    await load();
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return orders.filter((order) => !term || `${order.order_number} ${order.customer_name} ${order.customer_phone}`.toLocaleLowerCase("pt-BR").includes(term));
  }, [orders, search]);
  const active = orders.filter((order) => !["completed", "cancelled", "expired"].includes(order.status));

  return <section className="operation-instant-orders">
    <header>
      <div><small>Vendas de fatias</small><h2>Pedidos de retirada</h2><p>Pedidos enviados pelo site e reservas de estoque em uma fila única.</p></div>
      <button onClick={() => void load()} disabled={busy}><RefreshCw /> Atualizar</button>
    </header>
    <div className="instant-order-metrics">
      <span><strong>{active.length}</strong><small>em andamento</small></span>
      <span><strong>{orders.filter((order) => order.status === "awaiting_confirmation").length}</strong><small>para conferir</small></span>
      <span><strong>{orders.filter((order) => order.status === "awaiting_payment").length}</strong><small>aguardando pagamento</small></span>
      <span><strong>{orders.filter((order) => order.status === "ready").length}</strong><small>prontos</small></span>
    </div>
    {notice ? <p className="operation-commercial-notice" role="status">{notice}</p> : null}
    <label className="instant-order-search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar número, cliente ou celular" /></label>
    <div className="instant-order-operation-list">
      {filtered.map((order) => <button key={order.id} onClick={() => openOrder(order)}>
        <ShoppingCart />
        <span><small>{order.order_number}</small><strong>{order.customer_name}</strong><em>{order.instant_order_items.map((item) => `${item.quantity}× ${item.flavor_name}`).join(" · ")}</em></span>
        <span><strong>{money(order.total)}</strong><small>{dateTime(order.created_at)}</small></span>
        <b className={`status-${order.status}`}>{labels[order.status]}</b>
      </button>)}
      {!filtered.length ? <div className="operation-empty"><ShoppingCart /><p>Nenhum pedido de retirada encontrado.</p></div> : null}
    </div>
    {selected ? <div className="instant-order-operation-layer">
      <button className="instant-order-operation-backdrop" aria-label="Fechar" onClick={() => setSelected(null)} />
      <aside role="dialog" aria-modal="true" aria-label={`Pedido ${selected.order_number}`}>
        <button className="drawer-close" onClick={() => setSelected(null)} aria-label="Fechar"><X /></button>
        <small>{selected.order_number}</small><h2>{selected.customer_name}</h2>
        <p>{selected.customer_phone} · {labels[selected.status]}</p>
        <div className="instant-order-operation-items">{selected.instant_order_items.map((item) => <span key={item.id}><b>{item.quantity}×</b> {item.flavor_name}<strong>{money(item.quantity * Number(item.unit_price))}</strong></span>)}</div>
        <div className="instant-order-operation-total"><span>Total</span><strong>{money(selected.total)}</strong></div>
        <label>Link de pagamento<input type="url" value={paymentUrl} onChange={(event) => setPaymentUrl(event.target.value)} placeholder="Cole o link do Mercado Pago" /></label>
        <label>Anotações internas<textarea value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} /></label>
        <div className="instant-order-operation-actions">
          {selected.status === "awaiting_confirmation" ? <button onClick={() => void update("awaiting_payment")} disabled={busy}><Check /> Confirmar e reservar</button> : null}
          {["reserved", "awaiting_payment"].includes(selected.status) ? <button onClick={() => void update("paid")} disabled={busy}><Check /> Marcar como pago</button> : null}
          {selected.status === "paid" ? <button onClick={() => void update("preparing")} disabled={busy}><PackageCheck /> Iniciar separação</button> : null}
          {selected.status === "preparing" ? <button onClick={() => void update("ready")} disabled={busy}><PackageCheck /> Pedido pronto</button> : null}
          {selected.status === "ready" ? <button onClick={() => void update("completed")} disabled={busy}><Check /> Marcar como entregue</button> : null}
          {!["completed", "cancelled", "expired"].includes(selected.status) ? <button className="cancel" onClick={() => { const reason = window.prompt("Informe ao menos 5 caracteres explicando o cancelamento:")?.trim() || ""; if (reason.length >= 5) void update("cancelled", reason); }} disabled={busy}><X /> Cancelar pedido</button> : null}
        </div>
        <a href={`https://wa.me/${selected.customer_phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Olá, ${selected.customer_name.split(" ")[0]}! Estamos falando sobre o pedido ${selected.order_number} da Adoce.`)}`} target="_blank" rel="noreferrer"><MessageCircle /> Falar com o cliente</a>
        {selected.reserved_until ? <p className="instant-order-reservation"><Clock3 /> Reserva até {dateTime(selected.reserved_until)}</p> : null}
      </aside>
    </div> : null}
  </section>;
}
