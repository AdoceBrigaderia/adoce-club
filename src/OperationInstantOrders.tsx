import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Clock3, Gift, Heart, MessageCircle, PackageCheck, Pencil, Plus, Printer, Search, ShoppingCart, Trash2, X } from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import { formatarDataHora } from "./lib/datas";
import { formatarTelefoneBR, nomeLegivel } from "./lib/contato";
import { openOperationWhatsApp, operationWhatsAppUrl } from "./operation-whatsapp";
import OperationManualSale from "./OperationManualSale";
import "./operation-instant-orders.css";
import "./operation-instant-orders-enhancements.css";
import "./operation-print.css";
import { printOperation } from "./lib/operation-print";
import { printThermalOrder } from "./lib/thermal-printer";
import PedidoNaEsteira from "./PedidoNaEsteira";
import type { Pedido } from "./jornada-do-pedido";

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
  pickup_requested_time: string | null;
  pickup_method: "customer" | "driver" | null;
  internal_notes: string;
  customer_notes: string | null;
  created_at: string;
  instant_order_items: Array<{ id: string; flavor_id: string; flavor_name: string; quantity: number; unit_price: number; status: string; is_reward: boolean; reward_id: string | null; instant_order_item_sauces: Array<{ id: string; unit_number: number; sauce_id: string | null; sauce_name: string }> }>;
};
type PaymentMethod = { code: string; label: string; active: boolean };
type RewardFlavor = { id: string; name: string; base_price: number; remaining: number };
type OrderSauce = { id: string; name: string };
type EditUnit = { key: string; flavorId: string; sauceId: string };
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
export const buildInstantOrderEditPayload = (units: EditUnit[]) => {
  const grouped = new Map<string, Array<{ sauce_id: string | null }>>();
  units.forEach((unit) => {
    const sauces = grouped.get(unit.flavorId) || [];
    sauces.push({ sauce_id: unit.sauceId || null });
    grouped.set(unit.flavorId, sauces);
  });
  return Array.from(grouped, ([flavor_id, sauces]) => ({ flavor_id, quantity: sauces.length, sauces }));
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
  const [allFlavors, setAllFlavors] = useState<RewardFlavor[]>([]);
  const [rewardFlavors, setRewardFlavors] = useState<RewardFlavor[]>([]);
  const [rewardFlavorId, setRewardFlavorId] = useState("");
  const [orderSauces, setOrderSauces] = useState<OrderSauce[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editUnits, setEditUnits] = useState<EditUnit[]>([]);
  const [rewardMode, setRewardMode] = useState<"add" | "existing">("existing");
  const [rewardExistingUnit, setRewardExistingUnit] = useState("");
  const [loyalty, setLoyalty] = useState<LoyaltyContext | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [recoveryMethod, setRecoveryMethod] = useState("pix");
  const [directFinishOpen, setDirectFinishOpen] = useState(false);
  const [view, setView] = useState<"active" | "expired">("active");
  const directFinishRef = useRef<HTMLElement>(null);

  const load = useCallback(async () => {
    setBusy(true);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date());
    const [{ data, error }, { data: flavorData, error: flavorError }, { data: availabilityData, error: availabilityError }, { data: settingsData, error: settingsError }, { data: sauceData, error: sauceError }] = await Promise.all([
      requireSupabase().from("instant_orders")
        .select("*,instant_order_items(id,flavor_id,flavor_name,quantity,unit_price,status,is_reward,reward_id,instant_order_item_sauces(id,unit_number,sauce_id,sauce_name))")
        .order("created_at", { ascending: false }).limit(300),
      requireSupabase().from("flavors").select("id,name,base_price").eq("active", true).order("name"),
      requireSupabase().from("flavor_availability").select("flavor_id,status,quantity_available,quantity_reserved").eq("service_date", today),
      requireSupabase().rpc("staff_get_commerce_settings"),
      requireSupabase().from("order_sauces").select("id,name").eq("active", true).order("sort_order").order("name"),
    ]);
    setBusy(false);
    if (error || flavorError || availabilityError || settingsError || sauceError) return setNotice((error || flavorError || availabilityError || settingsError || sauceError)?.message || "Não foi possível atualizar a tela.");
    setOrders((data || []) as InstantOrder[]);
    const mappedFlavors = (flavorData || []).map((flavor) => {
      const availability = availabilityData?.find((item) => item.flavor_id === flavor.id);
      return {
        id: flavor.id,
        name: flavor.name,
        base_price: Number(flavor.base_price || 0),
        remaining: Math.max(0, Number(availability?.quantity_available || 0) - Number(availability?.quantity_reserved || 0)),
      };
    });
    setAllFlavors(mappedFlavors);
    setRewardFlavors(mappedFlavors.filter((flavor) => flavor.remaining > 0));
    setOrderSauces((sauceData || []) as OrderSauce[]);
    const activeMethods = ((settingsData?.payment_methods || []) as PaymentMethod[]).filter((method) => method.active);
    setPaymentMethods(activeMethods);
    setRecoveryMethod((current) => activeMethods.some((method) => method.code === current) ? current : (activeMethods[0]?.code || ""));
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!directFinishOpen) return;
    window.requestAnimationFrame(() => directFinishRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [directFinishOpen]);
  useEffect(() => {
    const supabase = requireSupabase();
    const channel = supabase.channel("operation-instant-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "instant_orders" }, async (change) => {
        void load();
        if (change.eventType !== "INSERT") return;
        const id = String((change.new as { id?: string }).id || "");
        if (!id) return;
        const { data } = await supabase.from("instant_orders")
          .select("*,instant_order_items(id,flavor_name,quantity,instant_order_item_sauces(unit_number,sauce_name))")
          .eq("id", id).single();
        if (!data) return;
        const result = await printThermalOrder(data as InstantOrder);
        setNotice(result === "printed" ? `${data.order_number}: comanda impressa automaticamente.` : `${data.order_number}: comanda aguardando o aplicativo Android da impressora.`);
      })
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
    setDirectFinishOpen(false);
    setEditOpen(false);
    setEditUnits([]);
    setRewardMode("existing");
    setRewardExistingUnit("");
    void loadLoyalty(order.id);
  };

  const refreshOpenOrder = async (orderId: string) => {
    const { data, error } = await requireSupabase().from("instant_orders")
      .select("*,instant_order_items(id,flavor_id,flavor_name,quantity,unit_price,status,is_reward,reward_id,instant_order_item_sauces(id,unit_number,sauce_id,sauce_name))")
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
    if (!selected) return;
    if (rewardMode === "add" && !rewardFlavorId) return setNotice("Escolha o sabor da fatia premiada.");
    if (rewardMode === "existing" && !rewardExistingUnit) return setNotice("Escolha qual fatia do pedido será premiada.");
    setBusy(true);
    const [targetItemId, unitNumber] = rewardExistingUnit.split(":");
    const { data, error } = rewardMode === "existing"
      ? await requireSupabase().rpc("staff_mark_existing_instant_order_item_reward", {
        target_order_id: selected.id,
        target_order_item_id: targetItemId,
        target_unit_number: Number(unitNumber),
      })
      : await requireSupabase().rpc("staff_set_instant_order_reward_item_scoped", {
        target_order_id: selected.id,
        target_flavor_id: rewardFlavorId,
      });
    setBusy(false);
    if (error) return setNotice(error.message);
    const difference = Number(data?.premium_difference || 0);
    setNotice(difference > 0
      ? `Fatia premiada definida. A diferença da opção premium é ${money(difference)}.`
      : rewardMode === "existing"
        ? "A fatia escolhida foi marcada como premiada, sem acrescentar outra ao pedido."
        : "Fatia premiada incluída no pedido e reservada no estoque.");
    await refreshOpenOrder(selected.id);
  };

  const openItemEditor = () => {
    if (!selected) return;
    setEditUnits(selected.instant_order_items
      .filter((item) => !item.is_reward)
      .flatMap((item) => Array.from({ length: item.quantity }, (_, index) => {
        const unit = index + 1;
        const sauce = item.instant_order_item_sauces.find((choice) => choice.unit_number === unit);
        return { key: `${item.id}:${unit}`, flavorId: item.flavor_id, sauceId: sauce?.sauce_id || "" };
      })));
    setEditOpen(true);
    setNotice("");
  };

  const saveItemEditor = async () => {
    if (!selected || editUnits.length < 1) return setNotice("O pedido precisa manter pelo menos uma fatia paga.");
    if (editUnits.some((unit) => !unit.flavorId)) return setNotice("Escolha o sabor de todas as fatias.");
    setBusy(true);
    const { error } = await requireSupabase().rpc("staff_edit_instant_order_items", {
      target_order_id: selected.id,
      requested_items: buildInstantOrderEditPayload(editUnits),
    });
    setBusy(false);
    if (error) return setNotice(error.message);
    setEditOpen(false);
    setNotice("Itens, quantidades e caldas do pedido foram atualizados com auditoria.");
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

  const finalizeDirectly = async () => {
    if (!selected) return;
    if (!recoveryMethod) return setNotice("Escolha como esta venda foi paga.");
    const order = selected;
    setBusy(true);
    setNotice("");
    try {
      const { data, error } = await requireSupabase().rpc("staff_finalize_instant_order_direct", {
        target_order_id: order.id,
        requested_payment_method: recoveryMethod,
        next_internal_notes: internalNotes || null,
      });
      if (error) {
        setNotice(`Não foi possível finalizar: ${error.message}`);
        return;
      }
      const stampsAdded = Number(data?.stamps_added || 0);
      const rewardRedeemed = Boolean(data?.reward_redeemed);
      setNotice(`${order.order_number} foi finalizado. Pagamento, estoque e financeiro foram atualizados.${stampsAdded ? ` ${stampsAdded} carimbo(s) foram lançados no Clube Adoce.` : ""}${rewardRedeemed ? " A fatia premiada também foi registrada." : ""}`);
      setDirectFinishOpen(false);
      setSelected(null);
      await load();
    } catch (error) {
      setNotice(`Não foi possível finalizar: ${error instanceof Error ? error.message : "falha de conexão com o banco."}`);
    } finally {
      setBusy(false);
    }
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return orders
      .filter((order) => view === "expired" ? order.status === "expired" : !["completed", "cancelled", "expired"].includes(order.status))
      .filter((order) => !term || `${order.order_number} ${order.customer_name} ${order.customer_phone}`.toLocaleLowerCase("pt-BR").includes(term));
  }, [orders, search, view]);
  const active = orders.filter((order) => !["completed", "cancelled", "expired"].includes(order.status));
  const rewardExistingOptions = selected?.instant_order_items
    .filter((item) => !item.is_reward)
    .flatMap((item) => Array.from({ length: item.quantity }, (_, index) => {
      const unit = index + 1;
      const sauce = item.instant_order_item_sauces.find((choice) => choice.unit_number === unit)?.sauce_name || "Sem calda";
      return { value: `${item.id}:${unit}`, label: `${item.flavor_name} · ${sauce}` };
    })) || [];

  return <section className="operation-instant-orders">
    <p className="instant-order-subheading">Pedidos enviados pelo site e reservas de estoque em uma fila única.</p>
    <div className="instant-order-metrics">
      <span><strong>{active.length}</strong><small>em andamento</small></span>
      <span><strong>{orders.filter((order) => order.status === "awaiting_confirmation").length}</strong><small>para conferir</small></span>
      <span><strong>{orders.filter((order) => order.status === "awaiting_payment").length}</strong><small>aguardando pagamento</small></span>
      <span><strong>{orders.filter((order) => order.status === "ready").length}</strong><small>prontos</small></span>
    </div>
    <OperationManualSale onCreated={() => void load()} />
    {notice ? <p className="operation-commercial-notice" role="status">{notice}</p> : null}
    <div className="instant-order-view-switch">
      <button className={view === "active" ? "active" : ""} onClick={() => setView("active")}>Em andamento</button>
      <button className={view === "expired" ? "active" : ""} onClick={() => setView("expired")}>Prazo encerrado ({orders.filter((order) => order.status === "expired").length})</button>
    </div>
    <label className="instant-order-search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar número, cliente ou celular" /></label>
    <div className="instant-order-operation-list">
      {filtered.map((order) => {
        const pedido: Pedido = {
          numero: order.order_number,
          cliente: order.customer_name,
          telefone: order.customer_phone,
          etapa: order.status,
          itens: order.instant_order_items.map((item) => ({
            sabor: item.flavor_name,
            quantidade: item.quantity,
            calda: item.instant_order_item_sauces.map((choice) => choice.sauce_name).join(" e ") || null,
            presente: item.is_reward,
          })),
          total: Number(order.total),
          retirada: order.pickup_address
            ? { local: order.pickup_address, aPartirDe: order.pickup_requested_time?.slice(0, 5) || order.pickup_label || "horário combinado" }
            : null,
          pago: order.payment_status === "approved",
        };
        return <PedidoNaEsteira key={order.id} pedido={pedido} criadoEm={order.created_at} onAbrir={() => openOrder(order)} />;
      })}
      {!filtered.length ? <div className="operation-empty"><ShoppingCart /><p>Nenhum pedido de retirada encontrado.</p></div> : null}
    </div>
    {selected ? <div className="instant-order-operation-layer">
      <button className="instant-order-operation-backdrop" aria-label="Fechar" onClick={() => setSelected(null)} />
      <aside className="print-scope" role="dialog" aria-modal="true" aria-label={`Pedido ${selected.order_number}`}>
        <button className="drawer-close" onClick={() => setSelected(null)} aria-label="Fechar"><X /></button>
        <div className="thermal-receipt-brand"><img src="/site/logo.webp" alt="Adoce Brigaderia" /><strong>ADOCE BRIGADERIA</strong></div>
        <small>{selected.order_number}</small><h2>{nomeLegivel(selected.customer_name)}</h2>
        <div className="operation-print-actions">
          <button type="button" className="drawer-print" onClick={async () => { const result = await printThermalOrder(selected, true); if (result === "queued_for_android") printOperation("thermal"); }}><Printer /> Imprimir cupom 58 mm</button>
          <button type="button" className="drawer-print secondary" onClick={() => printOperation("a4")}><Printer /> A4 ou salvar em PDF</button>
        </div>
        <p><a href={operationWhatsAppUrl(selected.customer_phone, `Olá! Estamos falando sobre o pedido ${selected.order_number} da Adoce.`)} target="_blank" rel="noreferrer">{formatarTelefoneBR(selected.customer_phone)}</a> · {labels[selected.status]}</p>
        <p><strong>Pedido em</strong> {formatarDataHora(selected.created_at)}{selected.pickup_label ? <> · <strong>Retirada</strong> {selected.pickup_label}</> : null}{selected.pickup_requested_time ? <> · <strong>Horário</strong> {selected.pickup_requested_time.slice(0, 5)} · {selected.pickup_method === "driver" ? "entregador de aplicativo" : "cliente"}</> : null}</p>
        {selected.customer_notes ? <p className="thermal-pickup-note">{selected.customer_notes}</p> : null}
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
          <div><Gift /><span><small>Fatia premiada</small><strong>Escolha como aplicar o prêmio neste pedido</strong></span></div>
          <select aria-label="Como aplicar a fatia premiada" value={rewardMode} onChange={(event) => { setRewardMode(event.target.value as "add" | "existing"); setRewardExistingUnit(""); }}>
            <option value="existing">Marcar uma fatia já escolhida</option>
            <option value="add">Adicionar uma nova fatia ao pedido</option>
          </select>
          {rewardMode === "existing" ? <select aria-label="Fatia existente que será premiada" value={rewardExistingUnit} onChange={(event) => setRewardExistingUnit(event.target.value)}>
            <option value="">Selecione uma fatia deste pedido</option>
            {rewardExistingOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select> : <select aria-label="Sabor da nova fatia premiada" value={rewardFlavorId} onChange={(event) => setRewardFlavorId(event.target.value)}>
            <option value="">Selecione um sabor disponível</option>
            {rewardFlavors.map((flavor) => <option key={flavor.id} value={flavor.id}>{flavor.name} · {flavor.remaining} disponível(is){flavor.base_price > 16 ? ` · diferença ${money(flavor.base_price - 16)}` : ""}</option>)}
          </select>}
          <button type="button" onClick={() => void setRewardItem()} disabled={busy || (rewardMode === "existing" ? !rewardExistingUnit : !rewardFlavorId)}><Gift /> {rewardMode === "existing" ? "Marcar esta fatia como premiada" : selected.instant_order_items.some((item) => item.is_reward) ? "Atualizar fatia premiada" : "Incluir fatia premiada"}</button>
        </section> : null}
        {["awaiting_confirmation", "reserved", "awaiting_payment"].includes(selected.status) ? <section className="instant-order-item-editor-shell">
          {!editOpen ? <button type="button" className="instant-order-edit-trigger" onClick={openItemEditor} disabled={busy}><Pencil /> Editar itens do pedido</button> : <div className="instant-order-item-editor">
            <header><div><small>Edição restrita</small><strong>Fatias e caldas</strong></div><button type="button" aria-label="Fechar edição" onClick={() => setEditOpen(false)} disabled={busy}><X /></button></header>
            <p>As alterações são conferidas no estoque, recalculadas e registradas na auditoria.</p>
            <div className="instant-order-edit-units">
              {editUnits.map((unit, index) => <div key={unit.key} className="instant-order-edit-unit">
                <strong>Fatia {index + 1}</strong>
                <select aria-label={`Sabor da fatia ${index + 1}`} value={unit.flavorId} onChange={(event) => setEditUnits((current) => current.map((candidate) => candidate.key === unit.key ? { ...candidate, flavorId: event.target.value } : candidate))}>
                  <option value="">Escolha o sabor</option>
                  {allFlavors.map((flavor) => <option key={flavor.id} value={flavor.id}>{flavor.name} · {money(flavor.base_price)}</option>)}
                </select>
                <select aria-label={`Calda da fatia ${index + 1}`} value={unit.sauceId} onChange={(event) => setEditUnits((current) => current.map((candidate) => candidate.key === unit.key ? { ...candidate, sauceId: event.target.value } : candidate))}>
                  <option value="">Sem calda</option>
                  {orderSauces.map((sauce) => <option key={sauce.id} value={sauce.id}>{sauce.name}</option>)}
                </select>
                <button type="button" className="remove" aria-label={`Excluir fatia ${index + 1}`} onClick={() => setEditUnits((current) => current.filter((candidate) => candidate.key !== unit.key))} disabled={busy || editUnits.length === 1}><Trash2 /> Excluir</button>
              </div>)}
            </div>
            <button type="button" className="instant-order-add-unit" onClick={() => setEditUnits((current) => [...current, { key: `new:${Date.now()}:${current.length}`, flavorId: allFlavors[0]?.id || "", sauceId: "" }])} disabled={busy || editUnits.length >= 30}><Plus /> Incluir fatia</button>
            <div className="instant-order-edit-actions"><button type="button" className="secondary" onClick={() => setEditOpen(false)} disabled={busy}>Cancelar</button><button type="button" onClick={() => void saveItemEditor()} disabled={busy || editUnits.length < 1}><Check /> Salvar alterações</button></div>
          </div>}
        </section> : null}
        <div className="instant-order-operation-items">{selected.instant_order_items.flatMap((item) => Array.from({ length: item.quantity }, (_, index) => { const unit = index + 1; const sauces = item.instant_order_item_sauces.filter((choice) => choice.unit_number === unit).map((choice) => choice.sauce_name).join(" e ") || "Sem calda"; return <span key={`${item.id}-${unit}`} className={item.is_reward ? "reward-item" : ""}><b className="thermal-checkbox">☐</b><span><strong>{item.flavor_name}</strong><small>Calda: {sauces}</small>{item.is_reward ? <small><Gift /> Fatia premiada do Clube Adoce</small> : null}</span><strong>{item.is_reward && Number(item.unit_price) === 0 ? "GRÁTIS" : money(Number(item.unit_price))}</strong></span>; }))}</div>
        <div className="instant-order-operation-total"><span>Total</span><strong>{money(selected.total)}</strong></div>
        <section className="thermal-checklist"><strong>CONFERÊNCIA</strong><span>☐ Sabores</span><span>☐ Caldas</span><span>☐ Embalado</span><span>☐ Identificado</span><span>☐ Pronto</span></section>
        <p className="thermal-friendly-message">Preparado com carinho para adoçar o seu dia. Obrigado por escolher a Adoce! ♡</p>
        {selected.payment_method_label ? <p><strong>Pagamento:</strong> {selected.payment_method_label}</p> : null}
        {selected.status === "expired" ? <section className="expired-recovery-box">
          <small>Venda com prazo encerrado</small><h3>O que aconteceu com este pedido?</h3><p>Você pode reabrir para continuar o atendimento ou registrar que ele já foi pago e entregue.</p>
          <label>Forma de pagamento<select value={recoveryMethod} onChange={(event) => setRecoveryMethod(event.target.value)}>{paymentMethods.map((method) => <option key={method.code} value={method.code}>{method.label}</option>)}</select></label>
          <div className="expired-recovery-actions"><button onClick={() => void reopenExpired()} disabled={busy}>Reabrir e continuar atendimento</button><button onClick={() => void finalizeExpired(false)} disabled={busy}>Registrar como pago e entregue</button><button onClick={() => { if (window.confirm("Use esta opção somente se a venda realmente aconteceu. O estoque será conciliado e o ajuste ficará registrado.")) void finalizeExpired(true); }} disabled={busy}>Concluir com ajuste de estoque</button></div>
        </section> : null}
        {directFinishOpen && !["completed", "cancelled", "expired"].includes(selected.status) ? <section ref={directFinishRef} className="instant-order-direct-finish">
          <small>Venda concluída fora do site</small>
          <h3>Confirmar pagamento e finalizar</h3>
          <label>Como a cliente pagou?
            <select value={recoveryMethod} onChange={(event) => setRecoveryMethod(event.target.value)}>
              <option value="">Escolha a forma de pagamento</option>
              {paymentMethods.map((method) => <option key={method.code} value={method.code}>{method.label}</option>)}
            </select>
          </label>
          {notice ? <p className="instant-order-direct-error" role="alert">{notice}</p> : null}
          <div>
            <button type="button" className="secondary" onClick={() => setDirectFinishOpen(false)} disabled={busy}>Voltar</button>
            <button type="button" onClick={() => void finalizeDirectly()} disabled={busy || !recoveryMethod}><Check /> {busy ? "Finalizando..." : "Confirmar e finalizar"}</button>
          </div>
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
          {!["completed", "cancelled", "expired"].includes(selected.status) ? <button className="direct-finish" onClick={() => setDirectFinishOpen(true)} disabled={busy}><Check /> Registrar como pago e finalizar</button> : null}
          {!["completed", "cancelled", "expired"].includes(selected.status) ? <button className="cancel" onClick={() => { const reason = window.prompt("Informe ao menos 5 caracteres explicando o cancelamento:")?.trim() || ""; if (reason.length >= 5) void update("cancelled", reason); }} disabled={busy}><X /> Cancelar pedido</button> : null}
        </div>
        <a href={operationWhatsAppUrl(selected.customer_phone, `Olá, ${selected.customer_name.split(" ")[0]}! Estamos falando sobre o pedido ${selected.order_number} da Adoce.`)} target="_blank" rel="noreferrer"><MessageCircle /> Falar com o cliente no WhatsApp Business</a>
        {selected.reserved_until ? <p className="instant-order-reservation"><Clock3 /> Reserva até {dateTime(selected.reserved_until)}</p> : null}
      </aside>
    </div> : null}
  </section>;
}
