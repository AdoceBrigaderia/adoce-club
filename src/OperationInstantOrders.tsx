import OrderCommunication from "./OrderCommunication";
import { ADOCE_PIX_KEY } from "./pix-payment";
import { dispatchOrderNotifications } from "./order-notification-dispatch";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Clock3, Gift, Heart, MessageCircle, PackageCheck, Pencil, Plus, Printer, Search, ShoppingCart, Trash2, X } from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import { formatarDataHora } from "./lib/datas";
import { formatarTelefoneBR, nomeLegivel } from "./lib/contato";

import "./operation-instant-orders.css";
import "./operation-instant-orders-enhancements.css";
import "./operation-print.css";
import { printOperation } from "./lib/operation-print";
import { printThermalOrder } from "./lib/thermal-printer";
import { Capacitor } from "@capacitor/core";
import PedidoNaEsteira from "./PedidoNaEsteira";
import type { Pedido } from "./jornada-do-pedido";
import { canStartPreparation, canReceivePayment, canCancelOrder } from "./order-actions";
import { confirmAction } from "./lib/confirm-dialog";

type InstantOrderStatus = "awaiting_confirmation" | "reserved" | "awaiting_payment" | "paid" | "preparing" | "ready" | "completed" | "cancelled" | "expired";
type InstantOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  status: InstantOrderStatus;
  payment_status: string;
  separation_confirmed_at?: string | null;
  updated_at?: string;
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
  reserved: "Reserva registrada",
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
  { status: "reserved", label: "Reserva registrada" },
  { status: "preparing", label: "Em separação" },
  { status: "awaiting_payment", label: "Separação confirmada" },
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
  // window.prompt() dentro do WebView do tablet e um dialogo nativo do
  // sistema, fora do controle do app -- comportamento inconsistente entre
  // aparelhos e versoes de Android, sem como estilizar nem garantir que
  // sempre aparece. Um formulario proprio, no mesmo padrao ja usado pelo
  // "Registrar como pago", tira essa incerteza.
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [view, setView] = useState<"active" | "expired" | "finished">("active");
  // Os números do topo filtram a fila (antes eram só informativos).
  const [statusFilter, setStatusFilter] = useState<"all" | "awaiting_confirmation" | "awaiting_payment" | "ready">("all");
  const showStatus = (next: typeof statusFilter) => { setView("active"); setStatusFilter((current) => (current === next && next !== "all" ? "all" : next)); };
  const [selectedPrintIds, setSelectedPrintIds] = useState<string[]>([]);
  const directFinishRef = useRef<HTMLElement>(null);

  const load = useCallback(async (background = false) => {
    if (!background) setBusy(true);
    try {
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
      if (error || flavorError || availabilityError || settingsError || sauceError) {
        setNotice((error || flavorError || availabilityError || settingsError || sauceError)?.message || "Não foi possível atualizar a tela.");
        return;
      }
      setOrders((data || []) as InstantOrder[]);
      setSelected((current) => current ? ((data || []) as InstantOrder[]).find((order) => order.id === current.id) || current : null);
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
    } catch (error) {
      // Sem isto, uma falha de rede (comum no wifi do balcao) fazia o
      // Promise.all rejeitar sem nenhum aviso: a tela ficava com dados
      // velhos -- por exemplo mostrando um pedido ja cancelado como se
      // ainda estivesse aberto -- e ninguem via mensagem de erro nenhuma.
      setNotice(`Não foi possível atualizar a tela: ${error instanceof Error ? error.message : "falha de conexão."} Toque em Atualizar para tentar de novo.`);
    } finally {
      if (!background) setBusy(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") void load(true); };
    const interval = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);
  useEffect(() => {
    if (!directFinishOpen) return;
    window.requestAnimationFrame(() => directFinishRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [directFinishOpen]);
  useEffect(() => {
    const supabase = requireSupabase();
    const channel = supabase.channel("operation-instant-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "instant_orders" }, async (change) => {
        void load();
        if (change.eventType !== "INSERT" || Capacitor.isNativePlatform()) return;
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
    setCancelOpen(false);
    setCancelReason("");
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
    try {
      const { error } = await requireSupabase().rpc("staff_update_instant_order", {
        target_order_id: order.id,
        next_status: status,
        next_payment_url: paymentLink || null,
        next_payment_expires_at: status === "awaiting_payment" ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null,
        next_internal_notes: internalNotes,
        next_cancellation_reason: reason || null,
      });
      if (error) {
        setNotice(error.message);
        return false;
      }
      void dispatchOrderNotifications(order.id);
      return true;
    } catch (error) {
      // Falha de rede aqui (fetch rejeitando em vez de devolver {error}) fazia
      // a promessa estourar sem aviso -- o atendente nao via nada, mesmo
      // quando a acao as vezes ainda chegava a acontecer no servidor.
      setNotice(`Não foi possível confirmar a alteração: ${error instanceof Error ? error.message : "falha de conexão."} Confira no site antes de repetir.`);
      return false;
    } finally {
      setBusy(false);
    }
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

  const sendPaymentLink = async () => {
    if (!selected) return;
    const cleanPaymentLink = selected.payment_method_code === "pix" ? "" : extractPaymentLink();
    if (selected.payment_method_code !== "pix" && !validPaymentUrl(cleanPaymentLink)) {
      setNotice("Cole um link válido para este meio de pagamento."); return;
    }
    setBusy(true);
    try {
      const result=await requireSupabase().rpc("staff_confirm_instant_order_separation",{target_order_id:selected.id,next_payment_url:cleanPaymentLink||null,next_internal_notes:internalNotes});
      if(result.error){setNotice(result.error.message);return;}
      void dispatchOrderNotifications(selected.id);
      setNotice("Separação confirmada. Acompanhe o envio da cobrança no histórico do WhatsApp oficial.");
      await refreshOpenOrder(selected.id);
    } catch {setNotice("Não foi possível confirmar a separação. Atualize antes de repetir.");}
    finally{setBusy(false);}
  };

  const confirmPaymentAndPrepare = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const {error} = await requireSupabase().rpc("staff_confirm_instant_order_payment", {
        target_order_id: selected.id, next_internal_notes: internalNotes,
      });
      if(error) {setNotice(error.message);return;}
      void dispatchOrderNotifications(selected.id);
      setNotice("Pagamento confirmado. Confira o pedido e libere para retirada quando estiver pronto.");
      await refreshOpenOrder(selected.id);
    } catch {setNotice("Não foi possível confirmar o pagamento. Atualize o pedido antes de repetir.");}
    finally {setBusy(false);}
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
      .filter((order) => view !== "active" || statusFilter === "all" || order.status === statusFilter)
      .filter((order) => view === "expired" ? order.status === "expired" : view === "finished" ? ["completed", "cancelled"].includes(order.status) : !["completed", "cancelled", "expired"].includes(order.status))
      .filter((order) => !term || `${order.order_number} ${order.customer_name} ${order.customer_phone}`.toLocaleLowerCase("pt-BR").includes(term));
  }, [orders, search, view, statusFilter]);
  const printSelected = async () => {
    const targets = orders.filter((order) => selectedPrintIds.includes(order.id));
    if (!targets.length) return setNotice("Selecione ao menos um pedido para reimprimir.");
    setBusy(true);
    try {
      if (Capacitor.isNativePlatform()) {
        // Dentro do app do tablet o proprio dispositivo e a impressora:
        // imprime direto, sem precisar de comando remoto.
        for (const order of targets) await printThermalOrder(order, true);
        setNotice(`${targets.length} pedido(s) enviado(s) para a fila de impressão do tablet.`);
      } else {
        // Num navegador comum (portal de operacao) nao ha impressora local
        // pareada de verdade -- manda o comando pro tablet reimprimir estas
        // comandas especificas pelo mesmo canal em tempo real do pedido novo.
        const { error } = await requireSupabase().rpc("server_request_order_reprint", {
          target_order_ids: targets.map((order) => order.id),
        });
        if (error) throw error;
        setNotice(`Comando de reimpressão enviado ao tablet para ${targets.length} pedido(s).`);
      }
    } catch (error) {
      setNotice(`Falha ao reimprimir: ${error instanceof Error ? error.message : "impressora indisponível."}`);
    }
    setBusy(false);
    setSelectedPrintIds([]);
  };

  // Este botao nunca tinha tratamento de erro nenhum: se a impressao
  // falhasse por qualquer motivo (Bluetooth desligado, impressora fora de
  // alcance, plugin nativo rejeitando a chamada), a promessa rejeitava sem
  // ninguem ver nada -- o atendente so via "nao aconteceu nada".
  const printSingleThermal = async (order: InstantOrder) => {
    setBusy(true);
    try {
      const result = await printThermalOrder(order, true);
      if (result === "queued_for_android" && !Capacitor.isNativePlatform()) {
        printOperation("thermal");
      } else if (result === "queued_for_android") {
        setNotice("A impressora não respondeu — o pedido ficou na fila do tablet e será impresso quando ela reconectar.");
      } else {
        setNotice(`${order.order_number}: cupom enviado para a impressora.`);
      }
    } catch (error) {
      setNotice(`Falha ao imprimir: ${error instanceof Error ? error.message : "impressora indisponível."}`);
    }
    setBusy(false);
  };
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
    <div className="instant-order-metrics" role="group" aria-label="Filtrar pedidos por etapa">
      <button type="button" aria-pressed={view === "active" && statusFilter === "all"} className={view === "active" && statusFilter === "all" ? "active" : ""} onClick={() => showStatus("all")}><strong>{active.length}</strong><small>em andamento</small></button>
      <button type="button" aria-pressed={statusFilter === "awaiting_confirmation"} className={statusFilter === "awaiting_confirmation" ? "active" : ""} onClick={() => showStatus("awaiting_confirmation")}><strong>{orders.filter((order) => order.status === "awaiting_confirmation").length}</strong><small>para conferir</small></button>
      <button type="button" aria-pressed={statusFilter === "awaiting_payment"} className={statusFilter === "awaiting_payment" ? "active" : ""} onClick={() => showStatus("awaiting_payment")}><strong>{orders.filter((order) => order.status === "awaiting_payment").length}</strong><small>aguardando pagamento</small></button>
      <button type="button" aria-pressed={statusFilter === "ready"} className={statusFilter === "ready" ? "active" : ""} onClick={() => showStatus("ready")}><strong>{orders.filter((order) => order.status === "ready").length}</strong><small>prontos</small></button>
    </div>

    {notice ? <p className="operation-commercial-notice" role="status">{notice}</p> : null}
    <div className="instant-order-view-switch">
      <button className={view === "active" ? "active" : ""} onClick={() => { setView("active"); setStatusFilter("all"); }}>Em andamento</button>
      <button className={view === "expired" ? "active" : ""} onClick={() => { setView("expired"); setStatusFilter("all"); }}>Prazo encerrado ({orders.filter((order) => order.status === "expired").length})</button>
      <button className={view === "finished" ? "active" : ""} onClick={() => { setView("finished"); setSelectedPrintIds([]); }}>Finalizados e reimpressão ({orders.filter((order) => ["completed", "cancelled"].includes(order.status)).length})</button>
    </div>
    {view === "finished" ? <div className="instant-order-reprint-toolbar"><span>Selecione as comandas que deseja reimprimir.</span><button type="button" onClick={() => void printSelected()} disabled={busy || !selectedPrintIds.length}><Printer /> Reimprimir selecionados ({selectedPrintIds.length})</button></div> : null}
    <label className="instant-order-search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar número, cliente ou celular" aria-label="Buscar pedido por número, cliente ou celular" /></label>
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
        return <div key={order.id} className="instant-order-row-with-select">{view === "finished" ? <label className="instant-order-reprint-select"><input type="checkbox" checked={selectedPrintIds.includes(order.id)} onChange={() => setSelectedPrintIds((current) => current.includes(order.id) ? current.filter((id) => id !== order.id) : [...current, order.id])} aria-label={`Selecionar ${order.order_number} para reimprimir`} /><span>Reimprimir</span></label> : null}<PedidoNaEsteira avisosOficiais pedido={pedido} criadoEm={order.created_at} atualizadoEm={order.updated_at} onAbrir={() => openOrder(order)} /></div>;
      })}
      {!filtered.length ? <div className="operation-empty"><ShoppingCart /><p>{statusFilter !== "all" && view === "active" ? "Nenhum pedido nesta etapa agora." : "Nenhum pedido de retirada encontrado."}</p></div> : null}
    </div>
    {selected ? <div className="instant-order-operation-layer">
      <button className="instant-order-operation-backdrop" aria-label="Fechar" onClick={() => setSelected(null)} />
      <aside className="print-scope" role="dialog" aria-modal="true" aria-label={`Pedido ${selected.order_number}`}>
        <button className="drawer-close" onClick={() => setSelected(null)} aria-label="Fechar"><X /></button>
        <div className="thermal-receipt-brand"><img src="/site/logo.webp" alt="Adoce Brigaderia" /><strong>ADOCE BRIGADERIA</strong></div>
        <small>{selected.order_number}</small><h2>{nomeLegivel(selected.customer_name)}</h2>
        {notice ? <p className="instant-order-direct-error" role="alert">{notice}</p> : null}
        <div className="operation-print-actions">
          <button type="button" className="drawer-print" disabled={busy} onClick={() => void printSingleThermal(selected)}><Printer /> Imprimir cupom 58 mm</button>
          <button type="button" className="drawer-print secondary" onClick={() => printOperation("a4")}><Printer /> A4 ou salvar em PDF</button>
        </div>
        <p>{formatarTelefoneBR(selected.customer_phone)} · {labels[selected.status]}</p>
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
          <div className="expired-recovery-actions"><button onClick={() => void reopenExpired()} disabled={busy}>Reabrir e continuar atendimento</button><button onClick={() => setCancelOpen(true)} disabled={busy}><Trash2 /> Excluir da fila</button><button onClick={() => void finalizeExpired(false)} disabled={busy}>Registrar como pago e entregue</button><button onClick={() => { void confirmAction("Use esta opção somente se a venda realmente aconteceu. O estoque será conciliado e o ajuste ficará registrado.", { confirmLabel: "Concluir com ajuste" }).then((ok) => { if (ok) void finalizeExpired(true); }); }} disabled={busy}>Concluir com ajuste de estoque</button></div>
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
        {selected.payment_method_code === "pix" ? <div className="instant-order-pix-key"><strong>Chave Pix da Adoce</strong><p>{ADOCE_PIX_KEY}</p><small>{selected.payment_status === "approved" ? "Pagamento conferido e confirmado pela equipe." : selected.separation_confirmed_at ? "Separação confirmada. Confira abaixo o envio da cobrança." : "A cobrança será enviada pelo WhatsApp oficial após confirmar a separação."}</small></div> : <label>Link de pagamento<input type="text" value={paymentUrl} onChange={(event) => setPaymentUrl(event.target.value)} placeholder="Cole o link ou a mensagem copiada do Mercado Pago" /><small className="payment-link-help">Pode colar a mensagem inteira. A operação localizará e enviará somente o link.</small></label>}
        <OrderCommunication key={selected.id} orderId={selected.id} />
        <label>Anotações internas<textarea value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} /></label>
        <div className="instant-order-operation-actions">
          {selected.status === "awaiting_confirmation" ? <button onClick={() => void update("reserved")} disabled={busy}><PackageCheck /> Registrar reserva no estoque</button> : null}
          {(["reserved", "preparing"].includes(selected.status) || (selected.status === "awaiting_payment" && !selected.separation_confirmed_at)) && selected.payment_status !== "approved" ? <button onClick={() => void sendPaymentLink()} disabled={busy}><MessageCircle /> Confirmar separação e enviar cobrança</button> : null}
          {selected.status === "reserved" ? <button onClick={() => void update("preparing")} disabled={busy}><PackageCheck /> Iniciar separação</button> : null}
          {selected.status === "awaiting_payment" && selected.payment_status !== "approved" ? <button onClick={() => void confirmPaymentAndPrepare()} disabled={busy}><Check /> Comprovante conferido: confirmar pagamento</button> : null}
          {["paid", "preparing"].includes(selected.status) && selected.payment_status === "approved" ? <button onClick={() => void update("ready")} disabled={busy}><PackageCheck /> Liberar para retirada e avisar</button> : null}
          {selected.status === "ready" ? <button onClick={() => void update("completed")} disabled={busy}><Check /> Marcar como entregue</button> : null}
          {!["completed", "cancelled", "expired"].includes(selected.status) ? <button className="direct-finish" onClick={() => setDirectFinishOpen(true)} disabled={busy}><Check /> Registrar como pago e finalizar</button> : null}
          {!["completed", "cancelled", "expired"].includes(selected.status) ? <button className="cancel" onClick={() => setCancelOpen(true)} disabled={busy}><X /> Cancelar pedido</button> : null}
        </div>
        {cancelOpen && canCancelOrder(selected.status) ? <section className="instant-order-direct-finish">
          <small>Cancelamento</small>
          <h3>Por que este pedido está sendo cancelado?</h3>
          {selected.status === "expired" ? <p>O pedido sairá desta fila e ficará no histórico de cancelados, com o motivo registrado.</p> : null}
          <label>Motivo (mínimo 5 caracteres)
            <textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Ex.: cliente desistiu, sabor esgotou, pedido duplicado..." autoFocus />
          </label>
          {notice ? <p className="instant-order-direct-error" role="alert">{notice}</p> : null}
          <div>
            <button type="button" className="secondary" onClick={() => { setCancelOpen(false); setCancelReason(""); }} disabled={busy}>Voltar</button>
            <button type="button" className="cancel" onClick={() => void update("cancelled", cancelReason.trim())} disabled={busy || cancelReason.trim().length < 5}><X /> {busy ? "Cancelando..." : "Confirmar cancelamento"}</button>
          </div>
        </section> : null}
        <p>Para conversar com o cliente, use o atendimento do WhatsApp oficial na área Hoje.</p>
        {selected.reserved_until ? <p className="instant-order-reservation"><Clock3 /> Reserva até {dateTime(selected.reserved_until)}</p> : null}
      </aside>
    </div> : null}
  </section>;
}
