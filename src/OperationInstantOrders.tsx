import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Clock3, Droplets, MessageCircle, PackageCheck, Plus, Printer, RefreshCw, Search, ShoppingCart, X } from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import "./operation-instant-orders.css";
import "./operation-instant-orders-enhancements.css";
import "./operation-print.css";

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
  instant_order_items: Array<{ id: string; flavor_name: string; quantity: number; unit_price: number; status: string; instant_order_item_sauces: Array<{ id: string; unit_number: number; sauce_name: string }> }>;
};
type OrderSauce = { id: string; name: string; active: boolean; sort_order: number };

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
const operationalSteps: Array<{ status: InstantOrderStatus; label: string }> = [
  { status: "awaiting_confirmation", label: "Recebido" },
  { status: "awaiting_payment", label: "Cobrança enviada" },
  { status: "preparing", label: "Em separação" },
  { status: "ready", label: "Aguardando retirada" },
  { status: "completed", label: "Entregue" },
];

export default function OperationInstantOrders() {
  const [orders, setOrders] = useState<InstantOrder[]>([]);
  const [selected, setSelected] = useState<InstantOrder | null>(null);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [sauces, setSauces] = useState<OrderSauce[]>([]);
  const [newSauce, setNewSauce] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    const [{ data, error }, { data: sauceData, error: sauceError }] = await Promise.all([
      requireSupabase().from("instant_orders")
        .select("*,instant_order_items(id,flavor_name,quantity,unit_price,status,instant_order_item_sauces(id,unit_number,sauce_name))")
        .order("created_at", { ascending: false }).limit(300),
      requireSupabase().from("order_sauces").select("id,name,active,sort_order").order("sort_order").order("name"),
    ]);
    setBusy(false);
    if (error || sauceError) return setNotice((error || sauceError)?.message || "Não foi possível atualizar a tela.");
    setOrders((data || []) as InstantOrder[]);
    setSauces((sauceData || []) as OrderSauce[]);
  }, []);

  const addSauce = async () => {
    const sauceName = newSauce.trim();
    if (sauceName.length < 2) return setNotice("Informe o nome da calda.");
    setBusy(true);
    const { error } = await requireSupabase().from("order_sauces").insert({
      name: sauceName,
      active: true,
      sort_order: (sauces.at(-1)?.sort_order || 0) + 10,
    });
    setBusy(false);
    if (error) return setNotice(error.message);
    setNewSauce("");
    setNotice(`${sauceName} foi adicionada e já está disponível.`);
    await load();
  };

  const toggleSauce = async (sauce: OrderSauce) => {
    setBusy(true);
    const { error } = await requireSupabase().from("order_sauces").update({ active: !sauce.active, updated_at: new Date().toISOString() }).eq("id", sauce.id);
    setBusy(false);
    if (error) return setNotice(error.message);
    setNotice(`${sauce.name}: ${sauce.active ? "indisponível por enquanto" : "disponível para os clientes"}.`);
    await load();
  };

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

  const persistStatus = async (order: InstantOrder, status: InstantOrderStatus, reason = "") => {
    setBusy(true);
    const { error } = await requireSupabase().rpc("staff_update_instant_order", {
      target_order_id: order.id,
      next_status: status,
      next_payment_url: paymentUrl || null,
      next_payment_expires_at: status === "awaiting_payment" ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null,
      next_internal_notes: internalNotes,
      next_cancellation_reason: reason || null,
    });
    setBusy(false);
    if (error) {
      setNotice(error.message);
      return false;
    }
    return true;
  };

  const update = async (status: InstantOrderStatus, reason = "") => {
    if (!selected) return false;
    if (!(await persistStatus(selected, status, reason))) return false;
    setNotice(`${selected.order_number}: ${labels[status].toLocaleLowerCase("pt-BR")}.`);
    setSelected(null);
    await load();
    return true;
  };

  const validPaymentUrl = () => {
    try {
      const parsed = new URL(paymentUrl.trim());
      return ["http:", "https:"].includes(parsed.protocol);
    } catch {
      return false;
    }
  };

  const sendPaymentLink = async (confirmReservation: boolean) => {
    if (!selected) return;
    if (!validPaymentUrl()) {
      setNotice("Cole um link de pagamento completo, começando com https://.");
      return;
    }
    const order = selected;
    const whatsapp = window.open("about:blank", "_blank");
    if (confirmReservation && !(await update("awaiting_payment"))) {
      whatsapp?.close();
      return;
    }
    const firstName = order.customer_name.trim().split(/\s+/)[0];
    const message = `Olá, ${firstName}! 💗 Confirmamos a disponibilidade e reservamos as fatias do pedido ${order.order_number}. Para concluir, faça o pagamento em até 15 minutos por este link: ${paymentUrl.trim()} Assim que o pagamento for confirmado, começamos a separação.`;
    const whatsappUrl = `https://wa.me/${order.customer_phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
    if (whatsapp) whatsapp.location.href = whatsappUrl;
    else window.location.href = whatsappUrl;
  };

  const updateAndNotify = async (status: InstantOrderStatus, message: (order: InstantOrder) => string) => {
    if (!selected) return;
    const order = selected;
    const whatsapp = window.open("about:blank", "_blank");
    if (!(await update(status))) {
      whatsapp?.close();
      return;
    }
    const whatsappUrl = `https://wa.me/${order.customer_phone.replace(/\D/g, "")}?text=${encodeURIComponent(message(order))}`;
    if (whatsapp) whatsapp.location.href = whatsappUrl;
    else window.location.href = whatsappUrl;
  };

  const confirmPaymentAndPrepare = async () => {
    if (!selected) return;
    const order = selected;
    const whatsapp = window.open("about:blank", "_blank");
    if (!(await persistStatus(order, "paid")) || !(await persistStatus(order, "preparing"))) {
      whatsapp?.close();
      return;
    }
    setSelected(null);
    setNotice(`${order.order_number}: pagamento confirmado e pedido em separação.`);
    await load();
    const firstName = order.customer_name.trim().split(/\s+/)[0];
    const message = `Olá, ${firstName}! 💗 Recebemos o pagamento do pedido ${order.order_number} e já iniciamos a separação das suas fatias. Avisaremos assim que estiver tudo pronto para retirada.`;
    const whatsappUrl = `https://wa.me/${order.customer_phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
    if (whatsapp) whatsapp.location.href = whatsappUrl;
    else window.location.href = whatsappUrl;
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
    <section className="instant-order-sauce-admin" aria-labelledby="order-sauces-title">
      <header><Droplets /><div><small>Complementos do pedido</small><h3 id="order-sauces-title">Caldas disponíveis</h3><p>O cliente só vê as caldas marcadas como disponíveis.</p></div></header>
      <div className="instant-order-sauce-options">
        {sauces.map((sauce) => <label key={sauce.id}>
          <input type="checkbox" checked={sauce.active} onChange={() => void toggleSauce(sauce)} disabled={busy} />
          <span><strong>{sauce.name}</strong><small>{sauce.active ? "Disponível hoje" : "Indisponível por enquanto"}</small></span>
        </label>)}
      </div>
      <div className="instant-order-sauce-new">
        <input value={newSauce} onChange={(event) => setNewSauce(event.target.value)} placeholder="Nome da nova calda" />
        <button type="button" onClick={() => void addSauce()} disabled={busy}><Plus /> Adicionar</button>
      </div>
    </section>
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
      <aside className="print-scope" role="dialog" aria-modal="true" aria-label={`Pedido ${selected.order_number}`}>
        <button className="drawer-close" onClick={() => setSelected(null)} aria-label="Fechar"><X /></button>
        <small>{selected.order_number}</small><h2>{selected.customer_name}</h2>
        <button type="button" className="drawer-print" onClick={() => window.print()}><Printer /> Imprimir ou salvar em PDF</button>
        <p>{selected.customer_phone} · {labels[selected.status]}</p>
        <ol className="instant-order-status-track" aria-label="Andamento do pedido">
          {operationalSteps.map((step, index) => {
            const currentIndex = operationalSteps.findIndex((candidate) => candidate.status === selected.status);
            const paidIndex = operationalSteps.findIndex((candidate) => candidate.status === "preparing");
            const effectiveIndex = selected.status === "paid" ? paidIndex - 1 : currentIndex;
            return <li key={step.status} className={index < effectiveIndex ? "done" : index === effectiveIndex ? "current" : ""}>
              <span>{index < effectiveIndex ? <Check /> : index + 1}</span><small>{step.label}</small>
            </li>;
          })}
        </ol>
        <div className="instant-order-operation-items">{selected.instant_order_items.map((item) => <span key={item.id}><b>{item.quantity}×</b><span>{item.flavor_name}{item.instant_order_item_sauces?.length ? <small>{item.instant_order_item_sauces.slice().sort((a, b) => a.unit_number - b.unit_number).map((choice) => `Fatia ${choice.unit_number}: ${choice.sauce_name}`).join(" · ")}</small> : null}</span><strong>{money(item.quantity * Number(item.unit_price))}</strong></span>)}</div>
        <div className="instant-order-operation-total"><span>Total</span><strong>{money(selected.total)}</strong></div>
        <label>Link de pagamento<input type="url" value={paymentUrl} onChange={(event) => setPaymentUrl(event.target.value)} placeholder="Cole o link do Mercado Pago" /></label>
        <label>Anotações internas<textarea value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} /></label>
        <div className="instant-order-operation-actions">
          {selected.status === "awaiting_confirmation" ? <button onClick={() => void sendPaymentLink(true)} disabled={busy}><MessageCircle /> Confirmar e enviar cobrança</button> : null}
          {["reserved", "awaiting_payment"].includes(selected.status) && paymentUrl ? <button className="payment-send" onClick={() => void sendPaymentLink(false)} disabled={busy}><MessageCircle /> Reenviar link pelo WhatsApp</button> : null}
          {["reserved", "awaiting_payment"].includes(selected.status) ? <button onClick={() => void confirmPaymentAndPrepare()} disabled={busy}><PackageCheck /> Pagamento recebido: iniciar separação e avisar</button> : null}
          {selected.status === "paid" ? <button onClick={() => void updateAndNotify("preparing", (order) => `Olá, ${order.customer_name.split(/\s+/)[0]}! 💗 O pagamento do pedido ${order.order_number} foi confirmado e suas fatias já estão em separação. Avisaremos assim que estiver tudo pronto.`)} disabled={busy}><PackageCheck /> Iniciar separação e avisar</button> : null}
          {selected.status === "preparing" ? <button onClick={() => void updateAndNotify("ready", (order) => `Olá, ${order.customer_name.split(/\s+/)[0]}! Seu pedido ${order.order_number} está separado e pronto para retirada. 📍 ${order.pickup_label}: ${order.pickup_address}`)} disabled={busy}><PackageCheck /> Pedido pronto e avisar retirada</button> : null}
          {selected.status === "ready" ? <button onClick={() => void update("completed")} disabled={busy}><Check /> Marcar como entregue</button> : null}
          {!["completed", "cancelled", "expired"].includes(selected.status) ? <button className="cancel" onClick={() => { const reason = window.prompt("Informe ao menos 5 caracteres explicando o cancelamento:")?.trim() || ""; if (reason.length >= 5) void update("cancelled", reason); }} disabled={busy}><X /> Cancelar pedido</button> : null}
        </div>
        <a href={`https://wa.me/${selected.customer_phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Olá, ${selected.customer_name.split(" ")[0]}! Estamos falando sobre o pedido ${selected.order_number} da Adoce.`)}`} target="_blank" rel="noreferrer"><MessageCircle /> Falar com o cliente</a>
        {selected.reserved_until ? <p className="instant-order-reservation"><Clock3 /> Reserva até {dateTime(selected.reserved_until)}</p> : null}
      </aside>
    </div> : null}
  </section>;
}
