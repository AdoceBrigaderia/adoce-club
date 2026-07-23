import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Clock3, Droplets, Gift, Heart, MessageCircle, PackageCheck, Plus, Printer, RefreshCw, Search, ShoppingCart, X } from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import { openOperationWhatsApp, operationWhatsAppUrl } from "./operation-whatsapp";
import OperationManualSale from "./OperationManualSale";
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
  payment_method_code: string | null;
  payment_method_label: string | null;
  checkout_mode: string;
  total: number;
  payment_url: string | null;
  payment_expires_at: string | null;
  reserved_until: string | null;
  pickup_label: string;
  pickup_address: string;
  internal_notes: string;
  created_at: string;
  instant_order_items: Array<{ id: string; flavor_id: string; flavor_name: string; quantity: number; unit_price: number; status: string; is_reward: boolean; reward_id: string | null; instant_order_item_sauces: Array<{ id: string; unit_number: number; sauce_name: string }> }>;
};
type OrderSauce = { id: string; name: string; active: boolean; sort_order: number };
type PaymentMethod = { code: string; label: string; active: boolean };
type RewardFlavor = { id: string; name: string; base_price: number; remaining: number };
type LoyaltyContext = {
  recognized: boolean;
  profile_id?: string;
  account_id?: string;
  member_name?: string;
  current_progress?: number;
  purchase_quantity: number;
  projected_progress?: number;
  projected_new_rewards?: number;
  available_rewards?: number;
  reward_choices?: number;
  will_unlock_reward?: boolean;
  message?: string;
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
export const extractPaymentUrl = (value: string) => {
  const match = value.match(/https?:\/\/[^\s]+/i)?.[0] || "";
  return match.replace(/[),.;]+$/, "");
};
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
  const [rewardFlavors, setRewardFlavors] = useState<RewardFlavor[]>([]);
  const [rewardFlavorId, setRewardFlavorId] = useState("");
  const [loyalty, setLoyalty] = useState<LoyaltyContext | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [recoveryMethod, setRecoveryMethod] = useState("pix");
  const [view, setView] = useState<"active" | "expired">("active");

  const load = useCallback(async () => {
    setBusy(true);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date());
    const [{ data, error }, { data: sauceData, error: sauceError }, { data: flavorData, error: flavorError }, { data: availabilityData, error: availabilityError }, { data: settingsData, error: settingsError }] = await Promise.all([
      requireSupabase().from("instant_orders")
        .select("*,instant_order_items(id,flavor_id,flavor_name,quantity,unit_price,status,is_reward,reward_id,instant_order_item_sauces(id,unit_number,sauce_name))")
        .order("created_at", { ascending: false }).limit(300),
      requireSupabase().from("order_sauces").select("id,name,active,sort_order").order("sort_order").order("name"),
      requireSupabase().from("flavors").select("id,name,base_price").eq("active", true).order("name"),
      requireSupabase().from("flavor_availability").select("flavor_id,status,quantity_available,quantity_reserved").eq("service_date", today),
      requireSupabase().rpc("staff_get_commerce_settings"),
    ]);
    setBusy(false);
    if (error || sauceError || flavorError || availabilityError || settingsError) return setNotice((error || sauceError || flavorError || availabilityError || settingsError)?.message || "Não foi possível atualizar a tela.");
    setOrders((data || []) as InstantOrder[]);
    setSauces((sauceData || []) as OrderSauce[]);
    setRewardFlavors((flavorData || []).map((flavor) => {
      const availability = availabilityData?.find((item) => item.flavor_id === flavor.id);
      return {
        id: flavor.id,
        name: flavor.name,
        base_price: Number(flavor.base_price || 0),
        remaining: Math.max(0, Number(availability?.quantity_available || 0) - Number(availability?.quantity_reserved || 0)),
      };
    }).filter((flavor) => flavor.remaining > 0));
    const activeMethods = ((settingsData?.payment_methods || []) as PaymentMethod[]).filter((method) => method.active);
    setPaymentMethods(activeMethods);
    setRecoveryMethod((current) => activeMethods.some((method) => method.code === current) ? current : (activeMethods[0]?.code || ""));
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

  const loadLoyalty = async (orderId: string) => {
    const { data, error } = await requireSupabase().rpc("staff_instant_order_loyalty_context", {
      target_order_id: orderId,
    });
    if (error) {
      setLoyalty(null);
      setNotice(error.message);
      return null;
    }
    const context = data as LoyaltyContext;
    setLoyalty(context);
    return context;
  };

  const openOrder = (order: InstantOrder) => {
    setSelected(order);
    setPaymentUrl(order.payment_url || "");
    setInternalNotes(order.internal_notes || "");
    setRewardFlavorId(order.instant_order_items.find((item) => item.is_reward)?.flavor_id || "");
    setLoyalty(null);
    setNotice("");
    void loadLoyalty(order.id);
  };

  const refreshOpenOrder = async (orderId: string) => {
    const { data, error } = await requireSupabase().from("instant_orders")
      .select("*,instant_order_items(id,flavor_id,flavor_name,quantity,unit_price,status,is_reward,reward_id,instant_order_item_sauces(id,unit_number,sauce_name))")
      .eq("id", orderId).single();
    if (error) return setNotice(error.message);
    const refreshed = data as InstantOrder;
    setSelected(refreshed);
    setPaymentUrl(refreshed.payment_url || paymentUrl);
    setInternalNotes(refreshed.internal_notes || internalNotes);
    setRewardFlavorId(refreshed.instant_order_items.find((item) => item.is_reward)?.flavor_id || "");
    await loadLoyalty(orderId);
    await load();
  };

  const setRewardItem = async () => {
    if (!selected || !rewardFlavorId) return setNotice("Escolha o sabor da fatia premiada.");
    setBusy(true);
    const { data, error } = await requireSupabase().rpc("staff_set_instant_order_reward_item", {
      target_order_id: selected.id,
      target_flavor_id: rewardFlavorId,
    });
    setBusy(false);
    if (error) return setNotice(error.message);
    const difference = Number(data?.premium_difference || 0);
    setNotice(difference > 0
      ? `Fatia premiada incluída. A diferença da opção premium é ${money(difference)}.`
      : "Fatia premiada incluída no pedido e reservada no estoque.");
    await refreshOpenOrder(selected.id);
  };

  const extractPaymentLink = () => extractPaymentUrl(paymentUrl);

  const persistStatus = async (order: InstantOrder, status: InstantOrderStatus, reason = "", paymentLink = extractPaymentLink()) => {
    setBusy(true);
    const { error } = await requireSupabase().rpc("staff_update_instant_order", {
      target_order_id: order.id,
      next_status: status,
      next_payment_url: paymentLink || null,
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

  const update = async (status: InstantOrderStatus, reason = "", paymentLink = extractPaymentLink()) => {
    if (!selected) return false;
    if (!(await persistStatus(selected, status, reason, paymentLink))) return false;
    setNotice(`${selected.order_number}: ${labels[status].toLocaleLowerCase("pt-BR")}.`);
    setSelected(null);
    await load();
    return true;
  };

  const validPaymentUrl = (value = extractPaymentLink()) => {
    try {
      const parsed = new URL(value);
      return ["http:", "https:"].includes(parsed.protocol);
    } catch {
      return false;
    }
  };

  const sendPaymentLink = async (confirmReservation: boolean) => {
    if (!selected) return;
    const cleanPaymentLink = extractPaymentLink();
    if (!validPaymentUrl(cleanPaymentLink)) {
      setNotice("Não encontrei um link de pagamento válido. Cole o texto ou o link gerado pelo Mercado Pago.");
      return;
    }
    setPaymentUrl(cleanPaymentLink);
    const order = selected;
    const whatsapp = window.open("about:blank", "_blank");
    if (confirmReservation && !(await update("awaiting_payment", "", cleanPaymentLink))) {
      whatsapp?.close();
      return;
    }
    const firstName = order.customer_name.trim().split(/\s+/)[0];
    const message = `Olá, ${firstName}! 💗 Confirmamos a disponibilidade e reservamos as fatias do pedido ${order.order_number}. Para concluir, faça o pagamento em até 15 minutos por este link: ${cleanPaymentLink} Assim que o pagamento for confirmado, começamos a separação.`;
    openOperationWhatsApp(order.customer_phone, message, whatsapp);
  };

  const updateAndNotify = async (status: InstantOrderStatus, message: (order: InstantOrder) => string) => {
    if (!selected) return;
    const order = selected;
    const whatsapp = window.open("about:blank", "_blank");
    if (!(await update(status))) {
      whatsapp?.close();
      return;
    }
    openOperationWhatsApp(order.customer_phone, message(order), whatsapp);
  };

  const confirmPaymentAndPrepare = async () => {
    if (!selected) return;
    const order = selected;
    const whatsapp = window.open("about:blank", "_blank");
    setBusy(true);
    const { data, error } = await requireSupabase().rpc("staff_confirm_instant_order_payment", {
      target_order_id: order.id,
      next_internal_notes: internalNotes,
    });
    setBusy(false);
    if (error || !(await persistStatus(order, "preparing"))) {
      if (error) setNotice(error.message);
      whatsapp?.close();
      return;
    }
    setSelected(null);
    const stampsAdded = Number(data?.stamps_added || 0);
    const newRewards = Number(data?.new_rewards || 0);
    const rewardRedeemed = Boolean(data?.reward_redeemed);
    setNotice(`${order.order_number}: pagamento confirmado e pedido em separação.${stampsAdded ? ` ${stampsAdded} carimbo(s) foram lançados no Clube Adoce.` : ""}${rewardRedeemed ? " A fatia premiada também foi registrada." : ""}`);
    await load();
    const firstName = order.customer_name.trim().split(/\s+/)[0];
    const loyaltyMessage = rewardRedeemed
      ? ` E tem um carinho especial: sua fatia-presente do Clube Adoce também já está sendo separada com o pedido. É um prazer presentear clientes fiéis como você! 💝`
      : newRewards > 0
        ? ` Você completou seu cartão do Clube Adoce e conquistou uma fatia-presente! 💝 Ela ficou disponível para combinarmos seu resgate.`
        : stampsAdded > 0
          ? ` Também confirmamos ${stampsAdded} novo(s) carimbo(s) no seu Clube Adoce. Obrigado por escolher a gente mais uma vez! 💗`
          : "";
    const message = `Olá, ${firstName}! 💗 Recebemos o pagamento do pedido ${order.order_number} e já iniciamos a separação das suas fatias.${loyaltyMessage} Avisaremos assim que estiver tudo pronto para retirada.`;
    openOperationWhatsApp(order.customer_phone, message, whatsapp);
  };

  const reopenExpired = async () => {
    if (!selected) return;
    setBusy(true);
    const { error } = await requireSupabase().rpc("staff_reopen_expired_instant_order", { target_order_id: selected.id });
    setBusy(false);
    if (error) return setNotice(error.message);
    setNotice(`${selected.order_number} voltou para a fila de conferência.`);
    setSelected(null); setView("active"); await load();
  };

  const finalizeExpired = async (reconcileInventory: boolean) => {
    if (!selected || !recoveryMethod) return setNotice("Escolha a forma de pagamento usada nesta venda.");
    setBusy(true);
    const { error } = await requireSupabase().rpc("staff_finalize_expired_instant_order", {
      target_order_id: selected.id,
      requested_payment_method: recoveryMethod,
      next_internal_notes: internalNotes,
      allow_inventory_reconciliation: reconcileInventory,
    });
    setBusy(false);
    if (error) {
      if (!reconcileInventory && /estoque/i.test(error.message)) setNotice("O estoque atual não comporta essa baixa. Confira os itens e use “Concluir com ajuste de estoque” somente se a venda realmente aconteceu.");
      else setNotice(error.message);
      return;
    }
    setNotice(`${selected.order_number} foi registrado como pago e entregue. Estoque, Clube Adoce e financeiro foram atualizados.`);
    setSelected(null); await load();
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return orders
      .filter((order) => view === "expired" ? order.status === "expired" : !["completed", "cancelled", "expired"].includes(order.status))
      .filter((order) => !term || `${order.order_number} ${order.customer_name} ${order.customer_phone}`.toLocaleLowerCase("pt-BR").includes(term));
  }, [orders, search, view]);
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
    <OperationManualSale onCreated={() => void load()} />
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
    <div className="instant-order-view-switch">
      <button className={view === "active" ? "active" : ""} onClick={() => setView("active")}>Em andamento</button>
      <button className={view === "expired" ? "active" : ""} onClick={() => setView("expired")}>Prazo encerrado ({orders.filter((order) => order.status === "expired").length})</button>
    </div>
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
        {loyalty ? <section className={`instant-order-loyalty ${loyalty.recognized ? "recognized" : "not-recognized"}`}>
          <Heart />
          {loyalty.recognized ? <div>
            <small>Clube Adoce reconhecido automaticamente</small>
            <h3>{loyalty.member_name}</h3>
            <p>Antes desta compra: <strong>{loyalty.current_progress} de 14 carimbos</strong>. Este pedido acrescenta {loyalty.purchase_quantity}.</p>
            {loyalty.will_unlock_reward ? <strong className="instant-order-reward-alert"><Gift /> Esta compra completa o cartão e libera uma fatia premiada.</strong> : null}
            {!loyalty.will_unlock_reward && Number(loyalty.available_rewards || 0) > 0 ? <strong className="instant-order-reward-alert"><Gift /> Esta cliente já possui uma fatia premiada disponível.</strong> : null}
          </div> : <div><small>Clube Adoce</small><h3>Cliente ainda não reconhecida</h3><p>{loyalty.message}</p></div>}
        </section> : null}
        {loyalty?.recognized && Number(loyalty.reward_choices || 0) > 0 && ["awaiting_confirmation", "reserved", "awaiting_payment"].includes(selected.status) ? <section className="instant-order-reward-picker">
          <div><Gift /><span><small>Fatia premiada</small><strong>Escolha o sabor que também sairá do estoque</strong></span></div>
          <select value={rewardFlavorId} onChange={(event) => setRewardFlavorId(event.target.value)}>
            <option value="">Selecione um sabor disponível</option>
            {rewardFlavors.map((flavor) => <option key={flavor.id} value={flavor.id}>{flavor.name} · {flavor.remaining} disponível(is){flavor.base_price > 16 ? ` · diferença ${money(flavor.base_price - 16)}` : ""}</option>)}
          </select>
          <button type="button" onClick={() => void setRewardItem()} disabled={busy || !rewardFlavorId}><Gift /> {selected.instant_order_items.some((item) => item.is_reward) ? "Atualizar fatia premiada" : "Incluir fatia premiada"}</button>
        </section> : null}
        <div className="instant-order-operation-items">{selected.instant_order_items.map((item) => <span key={item.id} className={item.is_reward ? "reward-item" : ""}><b>{item.quantity}×</b><span>{item.flavor_name}{item.is_reward ? <small><Gift /> Fatia premiada do Clube Adoce</small> : null}{item.instant_order_item_sauces?.length ? <small>{item.instant_order_item_sauces.slice().sort((a, b) => a.unit_number - b.unit_number).map((choice) => `Fatia ${choice.unit_number}: ${choice.sauce_name}`).join(" · ")}</small> : null}</span><strong>{item.is_reward && Number(item.unit_price) === 0 ? "GRÁTIS" : money(item.quantity * Number(item.unit_price))}</strong></span>)}</div>
        <div className="instant-order-operation-total"><span>Total</span><strong>{money(selected.total)}</strong></div>
        {selected.payment_method_label ? <p><strong>Pagamento:</strong> {selected.payment_method_label}</p> : null}
        {selected.status === "expired" ? <section className="expired-recovery-box">
          <small>Venda com prazo encerrado</small><h3>O que aconteceu com este pedido?</h3><p>Você pode reabrir para continuar o atendimento ou registrar que ele já foi pago e entregue.</p>
          <label>Forma de pagamento<select value={recoveryMethod} onChange={(event) => setRecoveryMethod(event.target.value)}>{paymentMethods.map((method) => <option key={method.code} value={method.code}>{method.label}</option>)}</select></label>
          <div className="expired-recovery-actions"><button onClick={() => void reopenExpired()} disabled={busy}>Reabrir e continuar atendimento</button><button onClick={() => void finalizeExpired(false)} disabled={busy}>Registrar como pago e entregue</button><button onClick={() => { if (window.confirm("Use esta opção somente se a venda realmente aconteceu. O estoque será conciliado e o ajuste ficará registrado.")) void finalizeExpired(true); }} disabled={busy}>Concluir com ajuste de estoque</button></div>
        </section> : null}
        <label>Link de pagamento<input type="text" value={paymentUrl} onChange={(event) => setPaymentUrl(event.target.value)} placeholder="Cole o link ou a mensagem copiada do Mercado Pago" /><small className="payment-link-help">Pode colar a mensagem inteira. A operação localizará e enviará somente o link.</small></label>
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
        <a href={operationWhatsAppUrl(selected.customer_phone, `Olá, ${selected.customer_name.split(" ")[0]}! Estamos falando sobre o pedido ${selected.order_number} da Adoce.`)} target="_blank" rel="noreferrer"><MessageCircle /> Falar com o cliente no WhatsApp Business</a>
        {selected.reserved_until ? <p className="instant-order-reservation"><Clock3 /> Reserva até {dateTime(selected.reserved_until)}</p> : null}
      </aside>
    </div> : null}
  </section>;
}
