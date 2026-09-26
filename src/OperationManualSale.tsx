import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, ShoppingBag, X, Store, MessageCircle, Banknote, CreditCard, Check, Delete, Printer } from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import { calculateTotals, recordPayment, type Discount, type Payment } from "./cash-register-domain";
import "./operation-commerce-tools.css";
import WhatsAppSupportInbox, { supportRequest } from "./WhatsAppSupportInbox";
import CashSessionActions from "./CashSessionActions";
import CashAdjustments from "./CashAdjustments";
import CashCustomerRegistration from "./CashCustomerRegistration";
import { validateDeferredSale, splitChange, paymentLabels } from "./cash-receivables";
import OperationInstantOrders from "./OperationInstantOrders";
import { printThermalOrder, type ThermalOrder } from "./lib/thermal-printer";
import { openOperationArea, paidSliceCount } from "./lib/operation-navigation";
import { cashChangedEvent } from "./CashDayGuard";
import { queuePrint } from "./lib/print-queue";
import { DEFAULT_PIX_KEY } from "./pix-payment";
import { openingReceipt, type OpeningReport } from "./lib/cash-reports";
import { cashNumber, timeOnly } from "./lib/thermal-format";


type Flavor = { id: string; name: string; short_name?: string | null; base_price: number; remaining: number };
type Method = { code: string; label: string; active: boolean };
type Sauce = { id: string; name: string };
type EntryMode = "order" | "sale";
type ChannelMode = "presential" | "official" | "private";
type BusinessWorkspace = {
  role: string;
  stores: Array<{ id: string; name: string; active: boolean }>;
  registers: Array<{ id: string; store_id: string; name: string; active: boolean }>;
  sessions: Array<{ id: string; store_id: string; register_id: string; status: string }>;
};
const dateKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date());
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function OperationManualSale({ onCreated }: { onCreated: () => void }) {
  const [flavors, setFlavors] = useState<Flavor[]>([]); const [methods, setMethods] = useState<Method[]>([]); const [sauces, setSauces] = useState<Sauce[]>([]);
  const [mode, setMode] = useState<EntryMode>("sale");
  const [channel, setChannel] = useState<ChannelMode>("presential");
  const [quantities, setQuantities] = useState<Record<string, number>>({}); const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  const [method, setMethod] = useState("pix"); const [notes, setNotes] = useState(""); const [sauceChoices, setSauceChoices] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState("");
  const [changePix, setChangePix] = useState("0");
  const [changeSource, setChangeSource] = useState("Conta pessoal");
  const [deferred, setDeferred] = useState(false);
  // Fidelidade do cartão de papel (cliente fora do sistema): fatia premiada, baixa estoque, conta como cortesia.
  const [loyalty, setLoyalty] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false); const [discountKind, setDiscountKind] = useState<Discount["kind"]>("none"); const [discountValue, setDiscountValue] = useState("0"); const [payments, setPayments] = useState<Payment[]>([]); const [paymentAmount, setPaymentAmount] = useState(""); const [quantityEditor, setQuantityEditor] = useState<Flavor | null>(null); const [quantityDraft, setQuantityDraft] = useState(""); const [afterSale, setAfterSale] = useState(false);
  const [workspace, setWorkspace] = useState<BusinessWorkspace | null>(null); const [draftKey, setDraftKey] = useState(() => crypto.randomUUID()); const [registerId, setRegisterId] = useState(""); const [openingFloat, setOpeningFloat] = useState("0");
  const [pendingCount, setPendingCount] = useState(0);
  const [pixKey, setPixKey] = useState(DEFAULT_PIX_KEY);
  const [reservationBusy, setReservationBusy] = useState(false);
  const reservationLock = useRef(false);
  const quantitiesRef = useRef<Record<string, number>>({});
  const [lastSale, setLastSale] = useState<ThermalOrder | null>(null);
  const [printNotice, setPrintNotice] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.get("whatsappStart")) return;
    setChannel("official");
    setMode("sale");
    localStorage.setItem("adoce-cash-channel", "official");
  }, []);
  useEffect(() => { const refresh = () => { void supportRequest().then((data) => setPendingCount((data.threads || []).filter((item: { has_customer_messages?: boolean }) => item.has_customer_messages).length)).catch(() => setPendingCount(0)); }; refresh(); const timer = window.setInterval(refresh, 30000); window.addEventListener("focus", refresh); window.addEventListener("adoce-support-updated", refresh); return () => { clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("adoce-support-updated", refresh); }; }, []);
  const load = useCallback(async () => {
    const [{ data: flavorData }, { data: availabilityData }, { data: settingsData }, { data: sauceData }, { data: workspaceData, error: workspaceError }] = await Promise.all([
      requireSupabase().from("flavors").select("id,name,short_name,base_price").eq("active", true).order("name"),
      requireSupabase().from("flavor_availability").select("flavor_id,status,quantity_available,quantity_reserved").eq("service_date", dateKey()),
      requireSupabase().rpc("staff_get_commerce_settings"),
      requireSupabase().from("order_sauces").select("id,name").eq("active", true).order("sort_order").order("name"),
      requireSupabase().rpc("staff_get_business_workspace"),
    ]);
    setFlavors((flavorData || []).map((flavor) => { const availability = availabilityData?.find((row) => row.flavor_id === flavor.id); return { id: flavor.id, name: flavor.name, short_name: flavor.short_name || flavor.name.split(/\s+/).slice(0, 3).join(" "), base_price: Number(flavor.base_price), remaining: Math.max(0, Number(availability?.quantity_available || 0) - Number(availability?.quantity_reserved || 0) + Number(quantitiesRef.current[flavor.id] || 0)) }; }).filter((flavor) => flavor.remaining > 0));
    const activeMethods = ((settingsData?.payment_methods || []) as Method[]).filter((item) => item.active); setMethods(activeMethods); if (!activeMethods.some((item) => item.code === method)) setMethod(activeMethods[0]?.code || "");
    setSauces((sauceData || []) as Sauce[]);
    setPixKey(String((settingsData as { pix_key?: string } | null)?.pix_key || DEFAULT_PIX_KEY));
    const nextWorkspace = workspaceData as BusinessWorkspace | null;
    if (workspaceError) setNotice(`Não foi possível carregar o caixa: ${workspaceError.message}`);
    setWorkspace(nextWorkspace);
    const activeRegisters = (nextWorkspace?.registers || []).filter((item) => item.active);
    if (!activeRegisters.some((item) => item.id === registerId)) setRegisterId(activeRegisters[0]?.id || "");
  }, [method, registerId]);
  useEffect(() => { void load(); }, [load]);
  // Caixa aberto/fechado por outra tela ou pelo fechamento automático: descarta o pedido em andamento e recarrega.
  useEffect(() => {
    const onCashChanged = () => { quantitiesRef.current = {}; setQuantities({}); setSauceChoices({}); setPayments([]); setPaymentModal(false); setDraftKey(crypto.randomUUID()); void load(); };
    window.addEventListener(cashChangedEvent, onCashChanged);
    return () => window.removeEventListener(cashChangedEvent, onCashChanged);
  }, [load]);
  const items = useMemo(() => flavors.filter((flavor) => (quantities[flavor.id] || 0) > 0).map((flavor) => ({
    flavor_id: flavor.id,
    quantity: quantities[flavor.id],
    ...(sauces.length ? { sauces: Array.from({ length: quantities[flavor.id] }, (_, index) => ({ unit_number: index + 1, sauce_id: sauceChoices[`${flavor.id}:${index + 1}`] === "none" ? null : (sauceChoices[`${flavor.id}:${index + 1}`] || null) })) } : {}),
  })), [flavors, quantities, sauceChoices, sauces.length, mode]);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (quantityEditor) setQuantityEditor(null);
        else if (paymentModal) setPaymentModal(false);
        else if (afterSale) setAfterSale(false);
        return;
      }
      if (event.key === "F2" && channel !== "official" && items.length && !paymentModal && !busy && !reservationBusy) {
        event.preventDefault();
        if (mode === "order") void submit(); else setPaymentModal(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const total = useMemo(() => flavors.reduce((sum, flavor) => sum + flavor.base_price * (quantities[flavor.id] || 0), 0), [flavors, quantities]);
  const openCashSession = workspace?.sessions.find((session) => session.status === "open") || null;
  const [openSessionInfo, setOpenSessionInfo] = useState<{ session_number: number; opened_at: string } | null>(null);
  useEffect(() => {
    if (!openCashSession?.id) { setOpenSessionInfo(null); return; }
    void requireSupabase().from("cash_sessions").select("session_number,opened_at").eq("id", openCashSession.id).maybeSingle()
      .then(({ data }) => setOpenSessionInfo((data as { session_number: number; opened_at: string } | null) || null));
  }, [openCashSession?.id]);
  const activeStores = (workspace?.stores || []).filter((store) => store.active);
  const activeRegisters = (workspace?.registers || []).filter((register) => register.active);
  const selectedRegister = activeRegisters.find((register) => register.id === registerId);
  const selectedStore = activeStores.find((store) => store.id === selectedRegister?.store_id) || activeStores[0];
  const setQuantity = async (flavor: Flavor, value: number) => {
    if (reservationLock.current || busy) return;
    if (!openCashSession) return setNotice("Abra o caixa para reservar as fatias.");
    const next = Math.max(0, Math.min(flavor.remaining, Math.floor(value)));
    const nextQuantities = { ...quantitiesRef.current, [flavor.id]: next };
    reservationLock.current = true; setReservationBusy(true); setNotice("");
    try {
      const { data, error } = await requireSupabase().rpc("staff_set_cash_draft_reservation", { target_session_id: openCashSession.id, target_draft_key: draftKey, requested_items: Object.entries(nextQuantities).filter(([, quantity]) => quantity > 0).map(([flavor_id, quantity]) => ({ flavor_id, quantity })) });
      if (error) throw error;
      if (!data?.accepted) throw new Error("Estoque insuficiente. Atualize os sabores disponíveis.");
      quantitiesRef.current = nextQuantities; setQuantities(nextQuantities);
      setSauceChoices((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${flavor.id}:`) || Number(key.split(":")[1]) <= next)));
    } catch (error) { setNotice(error instanceof Error ? error.message : String((error as {message?: string}).message || "Não foi possível reservar a fatia.")); }
    finally { reservationLock.current = false; setReservationBusy(false); }
  };
  const cancelDraft = async () => {
    if (reservationLock.current || busy) return;
    setBusy(true);
    try {
      if (openCashSession) { const {error} = await requireSupabase().rpc("staff_release_cash_draft_reservation", { target_session_id: openCashSession.id, target_draft_key: draftKey }); if (error) throw error; }
      quantitiesRef.current = {}; setQuantities({}); setSauceChoices({}); setPayments([]); setName(""); setPhone(""); setNotes(""); setDeferred(false); setLoyalty(false); setChangePix("0"); setPaymentAmount(""); setDiscountKind("none"); setDiscountValue("0"); setDraftKey(crypto.randomUUID()); setNotice("Pedido cancelado. Estoque liberado."); await load();
    } catch (error) { setNotice((error as Error).message); } finally { setBusy(false); }
  };
  const changeChannel = (next: ChannelMode) => {
    if (reservationLock.current || busy) return;
    if (Object.values(quantitiesRef.current).some(value => value > 0) && next !== channel) return setNotice("Conclua ou cancele o pedido antes de trocar o canal.");
    setChannel(next); setMode(next === "private" ? "order" : "sale"); localStorage.setItem("adoce-cash-channel", next); setNotice("");
  };
  const openCash = async () => {
    if (!registerId) return setNotice("Nenhum caixa ativo foi configurado para esta loja.");
    const initialAmount = Number(openingFloat.replace(",", "."));
    if (!Number.isFinite(initialAmount) || initialAmount < 0) return setNotice("Informe um valor inicial válido para abrir o caixa.");
    setBusy(true); setNotice("");
    const { data: openingReport, error } = await requireSupabase().rpc("staff_open_cash_with_report", { target_register_id: registerId, next_opening_float: initialAmount });
    setBusy(false);
    if (error) return setNotice(error.message);
    let printed = true;
    try { await queuePrint(`Abertura do caixa ${cashNumber((openingReport as OpeningReport)?.number)}`, openingReceipt(openingReport as OpeningReport)); } catch { printed = false; }
    setNotice(printed ? `Caixa ${cashNumber((openingReport as OpeningReport)?.number)} aberto. O comprovante de abertura foi enviado para a impressora do tablet.` : "Caixa aberto, mas o comprovante não entrou na fila de impressão. Reimprima pela aba Gestão.");
    window.dispatchEvent(new Event(cashChangedEvent));
    await load();
  };
  const discount: Discount = { kind: discountKind, value: Number(discountValue.replace(",", ".")) || 0 };
  const cashLines = flavors.filter((flavor) => (quantities[flavor.id] || 0) > 0).map((flavor) => ({ id: flavor.id, flavorId: flavor.id, shortName: flavor.short_name || flavor.name, unitPrice: flavor.base_price, quantity: quantities[flavor.id], sauce: sauceChoices[`${flavor.id}:1`] || null }));
  const totals = calculateTotals(cashLines, discount, payments);
  // Na fidelidade o cliente só paga a diferença de sabores acima de R$ 16.
  const loyaltyCharge = cashLines.reduce((sum, line) => sum + Math.max(0, line.unitPrice - 16) * line.quantity, 0);
  const addPayment = () => { const value = Number((paymentAmount || (method === "cash" ? "" : String(totals.remaining))).replace(",", ".")); if (!Number.isFinite(value) || value <= 0) return; setPayments((current) => recordPayment(current, { method: method as Payment["method"], amount: value })); setPaymentAmount(""); };
  const submit = async () => {
    if (!items.length) return setNotice("Inclua pelo menos uma fatia."); if (!method) return setNotice("Escolha a forma de pagamento.");
    if (mode === "order" && sauces.length && items.some((item) => item.sauces?.some((choice) => !choice.sauce_id && (sauceChoices[`${item.flavor_id}:${choice.unit_number}`] || "none") !== "none"))) return setNotice("Escolha a calda de cada fatia.");
    if (mode === "order" && name.trim().split(/\s+/).length < 2) return setNotice("Informe o nome e sobrenome do cliente para registrar o pedido.");
    if (mode === "order" && phone.replace(/\D/g, "").length < 10) return setNotice("Informe o WhatsApp do cliente com DDD.");
    // Abertura obrigatória: nenhuma venda sem caixa aberto no dia, para nenhum perfil.
    if (!openCashSession) return setNotice("Abra o caixa e informe o dinheiro inicial antes da primeira venda do dia.");
    if (reservationLock.current || busy) return;
    if (deferred && validateDeferredSale(name)) return setNotice(validateDeferredSale(name));
    if (deferred && payments.length) return setNotice("Remova os pagamentos antes de deixar a venda totalmente pendente.");
    if (loyalty && (deferred || payments.length)) return setNotice("Na fidelidade não há pagamento pendente nem pagamentos lançados. Remova-os.");
    if (mode === "sale" && !deferred && !loyalty && totals.remaining > 0) return setNotice("Adicione o restante por Pix, cartão ou dinheiro para concluir o pagamento.");
    try { splitChange(totals.change, Number(changePix.replace(",", "."))); } catch (error) { return setNotice((error as Error).message); }
    setBusy(true);
    const operationKey = draftKey;
    const paymentSummary = payments.length ? `Pagamento: ${payments.map((item) => `${item.method} ${money(item.amount)}`).join(" + ")}.` : "";
    const discountSummary = discount.kind !== "none" && discount.value > 0 ? `Desconto aplicado: ${discount.kind === "percent" ? `${discount.value}%` : money(discount.value)}.` : "";
    const result = mode === "order"
      ? await requireSupabase().rpc("staff_submit_cash_order_v1", { target_session_id: openCashSession!.id, target_draft_key: draftKey, requested_customer_name: name, requested_customer_phone: phone, requested_items: items, requested_payment_method: method, requested_notes: [notes, discountSummary, paymentSummary].filter(Boolean).join(" "), requested_reward: null })
      : loyalty
        ? await requireSupabase().rpc("staff_create_loyalty_cash_sale", { target_session_id: openCashSession.id, target_draft_key: draftKey, requested_operation_key: operationKey, requested_customer_name: name, requested_items: items, requested_payment_method: loyaltyCharge > 0 ? method : null, requested_notes: notes })
      : deferred && openCashSession
        ? await requireSupabase().rpc("staff_create_deferred_cash_sale", { target_session_id: openCashSession.id, target_draft_key: draftKey, requested_operation_key: operationKey, requested_customer_name: name, requested_items: items, requested_discount: discount, requested_notes: notes })
        : await requireSupabase().rpc("staff_create_manual_sale_in_cash_v6", { target_draft_key: draftKey, requested_operation_key: operationKey, target_session_id: openCashSession.id, requested_customer_name: name, requested_customer_phone: phone, requested_items: items, requested_payment_method: method, requested_discount: discount, requested_payments: payments, requested_change: { pix: Number(changePix.replace(",", ".")), source: changeSource }, requested_notes: [notes, discountSummary, paymentSummary].filter(Boolean).join(" ") })
    const { data, error } = result; setBusy(false);
    if (error) return setNotice(error.message);
    if (mode === "order" && !data?.accepted) return setNotice(data?.message || "Não foi possível registrar o pedido.");
    if (mode === "sale" && data?.order_id) {
      const { data: receipt } = await requireSupabase().from("instant_orders").select("*,instant_order_items(*,instant_order_item_sauces(*))").eq("id", data.order_id).single();
      if (receipt) { const order = { ...receipt, payments: data.payment_allocations || payments, remaining_balance: data.remaining || 0 } as ThermalOrder; setLastSale(order); try { const printed = await printThermalOrder(order); setPrintNotice(printed === "printed" ? "Cupom impresso" : "Impressão pendente no tablet"); } catch { setPrintNotice("Impressão pendente. Use Reimprimir."); } }
    }
    const wasLoyalty = loyalty;
    setChangePix("0"); setDeferred(false); setLoyalty(false); quantitiesRef.current = {}; setDraftKey(crypto.randomUUID()); setDiscountKind("none"); setDiscountValue("0");
    setNotice(mode === "order" ? `Pedido ${data?.order_number || ""} entrou na fila para conferência.` : wasLoyalty ? `Fidelidade ${data?.order_number || ""} registrada: estoque baixado e fatia contada como cortesia.` : openCashSession ? deferred ? `Venda ${data?.order_number || ""} concluída com pagamento pendente.` : `Venda ${data?.order_number || ""} registrada, estoque atualizado e pagamento contabilizado.` : `Venda ${data?.order_number || ""} baixada no estoque e enviada para conciliação do caixa.`); setQuantities({}); setSauceChoices({}); setName(""); setPhone(""); setNotes(""); setPayments([]); setPaymentModal(false); setAfterSale(mode === "sale"); onCreated(); void load();
  };
  return <section className="cash-register-page" aria-label="Caixa Adoce">
    <header className="cash-register-header"><div><small>VENDAS DE FATIAS</small><h2>Caixa <em>Adoce</em></h2>{openSessionInfo ? <span className="cash-session-badge">{cashNumber(openSessionInfo.session_number)} · aberto às {timeOnly(openSessionInfo.opened_at)}</span> : null}<p>Venda presencial e pedidos recebidos pelos canais.</p></div><button type="button" className="commerce-secondary-action" onClick={() => void load()}><ShoppingBag /> Atualizar</button></header>
    <div className="manual-sale-channel-switch cash-register-channels" role="group" aria-label="Origem do lançamento"><button type="button" className={channel === "presential" ? "active" : ""} onClick={() => changeChannel("presential")}><Store /> Presencial</button><button type="button" className={channel === "official" ? "active" : ""} onClick={() => changeChannel("official")}><MessageCircle /> WhatsApp oficial {pendingCount > 0 ? <b className="cash-badge">{pendingCount}</b> : null}</button><button type="button" className={channel === "private" ? "active" : ""} onClick={() => changeChannel("private")}><MessageCircle /> WhatsApp particular</button></div>
    <p className="operation-whatsapp-order-guidance">{channel === "official" ? "Pedidos concluídos no robô entram automaticamente nesta fila. Registrar pedido recebido no WhatsApp oficial: conversas e pedidos entram nesta fila para conferência." : channel === "private" ? "Cadastre o pedido combinado no WhatsApp particular. As etapas serão comunicadas pelo número oficial." : "Use para lançar vendas realizadas no balcão."}</p>
    {channel === "official" ? <div className="cash-official"><WhatsAppSupportInbox /><OperationInstantOrders /></div> : <div className="cash-register-layout"><main><h3>Fatias disponíveis hoje</h3>
      {notice ? <p className="operation-commercial-notice">{notice}</p> : null}
      {!openCashSession ? <section className="manual-sale-cash-state"><strong>Abra o caixa para começar as vendas de hoje</strong><p>Conte o dinheiro que está na gaveta e informe o valor. O comprovante de abertura sai na impressora do tablet.</p><label>Caixa<select value={registerId} onChange={(event) => setRegisterId(event.target.value)}>{activeRegisters.map((register) => <option key={register.id} value={register.id}>{register.name}</option>)}</select></label><label>Dinheiro inicial no caixa<input inputMode="decimal" value={openingFloat} onChange={(event) => setOpeningFloat(event.target.value)} /></label><button className="commerce-secondary-action" type="button" onClick={() => void openCash()} disabled={busy || !registerId}>{busy ? "Abrindo…" : "Abrir caixa"}</button></section> : null}
      {openCashSession ? <><div className="cash-register-flavors" aria-busy={reservationBusy}>{flavors.map((flavor) => <article className="cash-flavor-card" key={flavor.id}><button type="button" disabled={reservationBusy || busy} onClick={() => void setQuantity(flavor, (quantities[flavor.id] || 0) + 1)}><strong>{flavor.short_name || flavor.name}</strong><small>{money(flavor.base_price)}</small></button><div className="cash-flavor-qty"><button type="button" aria-label={`Diminuir ${flavor.short_name || flavor.name}`} disabled={reservationBusy || busy} onClick={() => void setQuantity(flavor, (quantities[flavor.id] || 0) - 1)}><Minus /></button><button type="button" className="cash-qty-value" aria-label={`Editar quantidade de ${flavor.short_name || flavor.name}`} onClick={() => { setQuantityEditor(flavor); setQuantityDraft(String(quantities[flavor.id] || 0)); }}>{quantities[flavor.id] || 0}</button><button type="button" aria-label={`Aumentar ${flavor.short_name || flavor.name}`} disabled={reservationBusy || busy} onClick={() => void setQuantity(flavor, (quantities[flavor.id] || 0) + 1)}><Plus /></button></div>{(quantities[flavor.id] || 0) > 0 && sauces.length ? <details className="cash-sauces"><summary>Caldas ({quantities[flavor.id]})</summary>{Array.from({length: quantities[flavor.id]}, (_, index) => <label key={index}>Fatia {index + 1}<select aria-label={`Calda ${index + 1} de ${flavor.short_name || flavor.name}`} value={sauceChoices[`${flavor.id}:${index + 1}`] || "none"} onChange={(event) => setSauceChoices(current => ({...current, [`${flavor.id}:${index + 1}`]: event.target.value}))}><option value="none">Sem calda</option>{sauces.map(sauce => <option key={sauce.id} value={sauce.id}>{sauce.name}</option>)}</select></label>)}</details> : null}</article>)}</div>
      {!flavors.length ? <div className="cash-empty-flavors" role="status"><strong>Nenhum sabor liberado para vender agora.</strong><p>Os sabores aparecem aqui quando estão como "Disponível" e com quantidade em Produtos → Disponibilidade.</p><button type="button" className="commerce-secondary-action" onClick={() => openOperationArea({ view: "products", contentTab: "today" })}>Liberar sabores de hoje</button></div> : null}</> : null}
      <div className="cash-register-mobile-fields" hidden={channel === "presential"}><label>Nome do cliente <small>(opcional no presencial)</small><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Maria da Silva" /></label><label>Celular <small>(opcional)</small><input inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="DDD + número" /></label></div>
    </main><aside className="cash-register-cart"><div className="cash-cart-heading"><strong><ShoppingBag /> Carrinho</strong><span>{itemCount} {itemCount === 1 ? "item" : "itens"}</span></div>{items.length ? items.map((item) => { const flavor = flavors.find((entry) => entry.id === item.flavor_id); return <div className="cash-cart-item" key={item.flavor_id}><span>{flavor?.short_name || flavor?.name}<small>{money((flavor?.base_price || 0) * item.quantity)}</small></span><b>{item.quantity}</b></div>; }) : <div className="cash-cart-empty"><ShoppingBag /><p>Seu carrinho está vazio.</p></div>}<div className="cash-cart-total"><span>Total</span><strong>{money(totals.total)}</strong></div><button type="button" className="cash-discount-link" onClick={() => setDiscountKind(discountKind === "none" ? "amount" : "none")}>Desconto <span>{discountKind === "none" ? money(0) : discountKind === "percent" ? `${discountValue}%` : money(discount.value) } ›</span></button>{discountKind !== "none" ? <div className="cash-discount-fields"><select value={discountKind} onChange={(event) => setDiscountKind(event.target.value as Discount["kind"])}><option value="amount">Valor</option><option value="percent">Percentual</option></select><input inputMode="decimal" value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} placeholder="0" /></div> : null}<label hidden={mode === "sale"}>Forma de pagamento<select value={method} onChange={(event) => setMethod(event.target.value)}>{methods.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></label><label>Observações<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Informações úteis" /></label><button className="commerce-secondary-action cash-cancel" type="button" onClick={() => void cancelDraft()} disabled={busy || reservationBusy || !items.length}>Cancelar pedido</button><button className="commerce-primary-action cash-finish" type="button" onClick={() => mode === "order" ? void submit() : setPaymentModal(true)} disabled={busy || reservationBusy || !items.length}>{busy ? "Registrando…" : (mode === "order" ? "Registrar pedido" : "Finalizar venda")}</button></aside>{items.length ? <div className="cash-mobile-checkout"><span><strong>{money(totals.total)}</strong><small>{itemCount} {itemCount === 1 ? "fatia" : "fatias"}</small></span><button type="button" onClick={() => mode === "order" ? void submit() : setPaymentModal(true)} disabled={busy || reservationBusy}>{mode === "order" ? "Registrar pedido" : "Cobrar"}</button></div> : null}</div>}
    <details className="cash-admin-menu"><summary>Gestão do caixa: sangria, suprimento, perdas, conferência e fechamento</summary><CashAdjustments sessionId={openCashSession?.id} flavors={flavors.map((flavor) => ({ id: flavor.id, name: flavor.name, remaining: flavor.remaining - (quantities[flavor.id] || 0) }))} onChanged={() => { setNotice("Lançamento registrado no caixa."); void load(); }} /><CashSessionActions sessionId={openCashSession?.id} storeId={openCashSession?.store_id || selectedStore?.id} hasDraft={items.length > 0} onChanged={() => void load()} /></details>
    {quantityEditor ? <div className="cash-modal-backdrop"><div className="cash-modal" role="dialog" aria-modal="true" aria-labelledby="cash-quantity-title"><button type="button" className="cash-modal-close" onClick={() => setQuantityEditor(null)} aria-label="Fechar teclado"><X /></button><h3 id="cash-quantity-title">Quantidade de {quantityEditor.short_name || quantityEditor.name}</h3><input autoFocus inputMode="numeric" value={quantityDraft} onChange={(event) => setQuantityDraft(event.target.value.replace(/\D/g, ""))} /><div className="cash-keypad">{[1,2,3,4,5,6,7,8,9,0].map((key) => <button type="button" className={key === 0 ? "cash-keypad-zero" : ""} key={key} onClick={() => setQuantityDraft((value) => `${value}${key}`.replace(/^0+(?=\d)/, ""))}>{key}</button>)}<button type="button" onClick={() => setQuantityDraft(value => value.slice(0,-1))} aria-label="Apagar último dígito"><Delete /></button><button type="button" className="cash-keypad-confirm" aria-label="Confirmar quantidade" onClick={() => { if (quantityEditor) void setQuantity(quantityEditor, Number(quantityDraft) || 0); setQuantityEditor(null); }}><Check /></button></div></div></div> : null}
    {paymentModal ? <div className="cash-modal-backdrop"><div className="cash-modal cash-payment-modal" role="dialog" aria-modal="true" aria-labelledby="cash-payment-title"><button type="button" className="cash-modal-close" onClick={() => setPaymentModal(false)} aria-label="Fechar pagamento"><X /></button><h3 id="cash-payment-title">Forma de pagamento</h3><label><input type="checkbox" checked={deferred} disabled={payments.length > 0 || loyalty} onChange={event => setDeferred(event.target.checked)} /> Pagamento pendente</label><label><input type="checkbox" checked={loyalty} disabled={payments.length > 0 || deferred} onChange={event => setLoyalty(event.target.checked)} /> Fidelidade (cartão de papel)</label>{deferred ? <label>Nome do cliente<input autoComplete="name" value={name} onChange={event => setName(event.target.value)} required /><small>A venda será concluída e o estoque baixado. O valor ficará a receber.</small></label> : null}{loyalty ? <label>Nome do cliente <small>(opcional)</small><input autoComplete="name" value={name} onChange={event => setName(event.target.value)} /><small>Fatia premiada do cartão de papel: baixa o estoque e conta como cortesia do Clube. {loyaltyCharge > 0 ? `Sabor especial: cobrar a diferença de ${money(loyaltyCharge)}.` : "Sem cobrança."}</small></label> : null}{notice ? <p role="alert">{notice}</p> : null}<div className="cash-payment-total">Total: <strong>{money(loyalty ? loyaltyCharge : totals.total)}</strong></div><div className="cash-payment-methods" hidden={deferred || (loyalty && loyaltyCharge <= 0)}>{["cash","pix","credit_card","debit_card","payroll"].map((value) => <button type="button" className={method === value ? "active" : ""} key={value} onClick={() => setMethod(value)}>{value === "cash" || value === "payroll" ? <Banknote /> : value === "pix" ? <span className="cash-pix-symbol">Pix</span> : <CreditCard />}{value === "cash" ? "Dinheiro" : value === "pix" ? "Pix" : value === "credit_card" ? "Cartão crédito" : value === "debit_card" ? "Cartão débito" : "Desconto em folha"}</button>)}</div><p hidden={deferred || method !== "payroll"} className="cash-pix-help">Desconto em folha: o valor não entra no caixa, é descontado do salário do funcionário. Informe o nome do funcionário nas observações.</p><p hidden={deferred || method !== "pix"} className="cash-pix-help">Caso o aparelho do cliente esteja com dificuldade de ler o QR Code, informe esta chave Pix: <strong>{pixKey}</strong></p><label hidden={deferred || loyalty}>{method === "cash" ? "Valor recebido" : "Valor deste pagamento"}<input inputMode="decimal" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} placeholder={money(totals.remaining)} /></label><button type="button" className="cash-add-payment" hidden={deferred || loyalty} onClick={addPayment}>Adicionar pagamento</button>{payments.length ? <div className="cash-payments-list">{payments.map((item, index) => <div key={`${item.method}-${index}`}>{paymentLabels[item.method] || item.method} <strong>{money(item.amount)}</strong></div>)}</div> : null}{totals.change > 0 && !deferred ? <section><label>Valor do troco devolvido por Pix<input inputMode="decimal" value={changePix} onChange={event => setChangePix(event.target.value)} /></label><label>Conta de onde saiu o Pix<input value={changeSource} onChange={event => setChangeSource(event.target.value)} /></label><p>Informe aqui depois de fazer o Pix. O sistema apenas registra a devolução.</p><p>Troco em dinheiro: {money(Math.max(0, totals.change - (Number(changePix.replace(",", ".")) || 0)))}</p></section> : null}<div className="cash-payment-balance" hidden={loyalty}>{totals.change > 0 ? `Troco: ${money(totals.change)}` : totals.remaining > 0 ? `Restante: ${money(totals.remaining)}` : "Pagamento completo"}</div><button type="button" className="commerce-primary-action" disabled={busy || reservationBusy || (!deferred && !loyalty && totals.remaining > 0)} onClick={() => void submit()}>{busy ? "Finalizando…" : loyalty ? "Registrar fidelidade" : deferred ? "Finalizar com pagamento pendente" : totals.remaining > 0 ? "Adicione o pagamento restante" : "Confirmar pagamento"}</button></div></div> : null}
    {afterSale ? <div className="cash-modal-backdrop"><div className="cash-modal" role="dialog" aria-modal="true" aria-labelledby="cash-after-title"><button type="button" className="cash-modal-close" onClick={() => setAfterSale(false)} aria-label="Fechar e abrir novo pedido"><X /></button><h3 id="cash-after-title">Venda finalizada</h3><p>{printNotice}</p>{lastSale ? <button type="button" onClick={() => void printThermalOrder(lastSale, true).then(() => setPrintNotice("Cupom enviado para impressão")).catch(() => setPrintNotice("Impressora indisponível. Tente novamente."))}><Printer /> Reimprimir</button> : null}<CashCustomerRegistration /><p>Deseja lançar carimbos para um cliente cadastrado ou abrir um novo pedido?</p><div className="cash-after-actions"><button type="button" onClick={() => setAfterSale(false)}>Abrir novo pedido</button><button type="button" onClick={() => { setAfterSale(false); openOperationArea({ view: "attend", stampSale: lastSale ? { orderNumber: String(lastSale.order_number || ""), quantity: paidSliceCount(lastSale) } : undefined }); }}>Lançar carimbos</button></div></div></div> : null}
  </section>;
}











