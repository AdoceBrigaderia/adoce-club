import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, ShoppingBag, X, Store, Check, Delete, Printer } from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import { calculateTotals, type Discount } from "./cash-register-domain";
import "./operation-commerce-tools.css";
import WhatsAppSupportInbox from "./WhatsAppSupportInbox";
import CashSessionActions from "./CashSessionActions";
import CashAdjustments from "./CashAdjustments";
import CashCustomerRegistration from "./CashCustomerRegistration";
import { validateDeferredSale, splitChange } from "./cash-receivables";
import { canEnrollSaleCustomer, enrollFieldsError, enrollSaleCustomer, enrollSummary } from "./sale-club-enroll";
import { cashDraftRequestedItems, cashDraftStorageKey } from "./cash-draft-persistence";
import OperationInstantOrders from "./OperationInstantOrders";
import type { ThermalOrder } from "./lib/thermal-printer";
import { printCashSale } from "./lib/cash-sale-print";
import CashCheckoutDialog from "./CashCheckoutDialog";
import CashReprintDialog from "./CashReprintDialog";
import type { CashCheckoutRequest } from "./cash-fast-checkout";
import { openOperationArea, paidSliceCount } from "./lib/operation-navigation";
import { cashChangedEvent } from "./CashDayGuard";
import { queuePrint } from "./lib/print-queue";
import { DEFAULT_PIX_KEY } from "./pix-payment";
import { openingReceipt, type OpeningReport } from "./lib/cash-reports";
import { cashNumber } from "./lib/thermal-format";
import CashCustomerSelector from "./CashCustomerSelector";
import { rewardUnitOptions, resolveLoyaltyMode, type CashCustomer } from "./cash-customer-selector";
import OperationWhatsAppAlerts from "./OperationWhatsAppAlerts";
import { confirmAction } from "./lib/confirm-dialog";


type Flavor = { id: string; name: string; short_name?: string | null; base_price: number; stock: number; reserved: number; free: number; remaining: number };
type Method = { code: string; label: string; active: boolean };
type PayrollEmployee = { id: string; name: string };
type Sauce = { id: string; name: string };
type EntryMode = "order" | "sale";
type ChannelMode = "presential" | "official";
type CashDraftSnapshot = {
  draftKey: string; quantities: Record<string, number>; name: string; phone: string;
  notes: string; sauceChoices: Record<string, string>; discountKind: Discount["kind"];
  discountValue: string; selectedCustomer: CashCustomer | null; manualRewardUnit: string;
  digitalRewardUnit: string; updatedAt: string;
};
type BusinessWorkspace = {
  role: string;
  stores: Array<{ id: string; name: string; active: boolean }>;
  registers: Array<{ id: string; store_id: string; name: string; active: boolean }>;
  sessions: Array<{ id: string; store_id: string; register_id: string; status: string }>;
};
const CANCEL_REASONS = ["Cliente desistiu", "Pedido em duplicidade", "Erro de digitação", "Erro de estoque"] as const;
const dateKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date());
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
// Campo de valor em centavos: só dígitos, a vírgula caminha sozinha enquanto
// a pessoa digita (igual app de banco). O estado guarda os dígitos crus.
const centsDigits = (value: string) => value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
const centsToAmount = (digits: string) => Number(digits || "0") / 100;
const centsToDisplay = (digits: string) => centsToAmount(digits).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function OperationManualSale({ onCreated }: { onCreated: () => void }) {
  const [flavors, setFlavors] = useState<Flavor[]>([]); const [methods, setMethods] = useState<Method[]>([]); const [sauces, setSauces] = useState<Sauce[]>([]);
  const [payrollEmployees, setPayrollEmployees] = useState<PayrollEmployee[]>([]);
  const [mode, setMode] = useState<EntryMode>("sale");
  const [channel, setChannel] = useState<ChannelMode>("presential");
  const [quantities, setQuantities] = useState<Record<string, number>>({}); const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  const [method, setMethod] = useState("pix"); const [notes, setNotes] = useState(""); const [sauceChoices, setSauceChoices] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState("");
  const [enrollNotice, setEnrollNotice] = useState("");
  const [paymentModal, setPaymentModal] = useState(false); const [discountKind, setDiscountKind] = useState<Discount["kind"]>("none"); const [discountValue, setDiscountValue] = useState("0"); const [quantityEditor, setQuantityEditor] = useState<Flavor | null>(null); const [quantityDraft, setQuantityDraft] = useState("");
  const [cancelReasonOpen, setCancelReasonOpen] = useState(false); const [cancelReasonCustom, setCancelReasonCustom] = useState("");
  const [workspace, setWorkspace] = useState<BusinessWorkspace | null>(null); const [draftKey, setDraftKey] = useState<string>(() => crypto.randomUUID()); const [registerId, setRegisterId] = useState(""); const [openingFloat, setOpeningFloat] = useState("");
  const [pixKey,setPixKey] = useState(DEFAULT_PIX_KEY);
  const [reservationBusy, setReservationBusy] = useState(false);
  const [releaseBusy, setReleaseBusy] = useState(false);
  const reservationLock = useRef(false);
  const quantitiesRef = useRef<Record<string, number>>({});
  const [lastSale, setLastSale] = useState<ThermalOrder | null>(null);
  const [printNotice, setPrintNotice] = useState("");
  const [printReceipt, setPrintReceipt] = useState(false);
  const [reprintOpen, setReprintOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CashCustomer | null>(null);
  const [manualRewardUnit, setManualRewardUnit] = useState("");
  const [digitalRewardUnit, setDigitalRewardUnit] = useState("");
  const checkoutLock = useRef(false);
  const hydratedDraftSession = useRef("");
  const flavorHeading = useRef<HTMLHeadingElement>(null);
  const load = useCallback(async () => {
    const [{ data: flavorData }, { data: availabilityData }, { data: settingsData }, { data: sauceData }, { data: workspaceData, error: workspaceError }, {data: employeeData}] = await Promise.all([
      requireSupabase().from("flavors").select("id,name,short_name,base_price").eq("active", true).order("name"),
      requireSupabase().from("flavor_availability").select("flavor_id,status,quantity_available,quantity_reserved").eq("service_date", dateKey()),
      requireSupabase().rpc("staff_get_commerce_settings"),
      requireSupabase().from("order_sauces").select("id,name").eq("active", true).order("sort_order").order("name"),
      requireSupabase().rpc("staff_get_business_workspace"),
      requireSupabase().rpc("staff_list_payroll_employees"),
    ]);
    setFlavors((flavorData || []).map((flavor) => { const availability = availabilityData?.find((row) => row.flavor_id === flavor.id); const stock=Number(availability?.quantity_available || 0),reserved=Number(availability?.quantity_reserved || 0),free=Math.max(0,stock-reserved),own=Number(quantitiesRef.current[flavor.id] || 0); return { id: flavor.id, name: flavor.name, short_name: flavor.short_name || flavor.name.split(/\s+/).slice(0, 3).join(" "), base_price: Number(flavor.base_price), stock, reserved, free, remaining: free+own }; }).filter((flavor) => flavor.remaining > 0));
    const activeMethods = ((settingsData?.payment_methods || []) as Method[]).filter((item) => item.active); setMethods(activeMethods); if (!activeMethods.some((item) => item.code === method)) setMethod(activeMethods[0]?.code || "");
    setSauces((sauceData || []) as Sauce[]);
    setPayrollEmployees(((employeeData || []) as Array<{employee_id:string;full_name:string}>).map(employee=>({id:employee.employee_id,name:employee.full_name})));
    setPixKey(String(settingsData?.pix_key || DEFAULT_PIX_KEY));
    const nextWorkspace = workspaceData as BusinessWorkspace | null;
    if (workspaceError) setNotice(`Não foi possível carregar o caixa: ${workspaceError.message}`);
    setWorkspace(nextWorkspace);
    const activeRegisters = (nextWorkspace?.registers || []).filter((item) => item.active);
    if (!activeRegisters.some((item) => item.id === registerId)) setRegisterId(activeRegisters[0]?.id || "");
  }, [method, registerId]);
  useEffect(() => { void load(); }, [load]);
  // Caixa aberto/fechado por outra tela ou pelo fechamento automático: descarta o pedido em andamento e recarrega.
  useEffect(() => {
    const onCashChanged = () => { quantitiesRef.current = {}; setQuantities({}); setSauceChoices({}); setPrintReceipt(false); setPaymentModal(false); setDraftKey(crypto.randomUUID()); void load(); };
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
      const dialog = document.querySelector<HTMLElement>('.cash-register-page [role="dialog"]');
      if(event.key === "Tab" && dialog) {
        const controls = Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')).filter(element=>element.getClientRects().length);
        const first = controls[0], last = controls[controls.length-1];
        if(first && (!dialog.contains(document.activeElement) || (event.shiftKey && document.activeElement===first) || (!event.shiftKey && document.activeElement===last))) {event.preventDefault();(event.shiftKey ? last : first).focus();}
      }
      if (event.key === "Escape") {
        if(busy || checkoutLock.current) return;
        if(dialog) {dialog.querySelector<HTMLButtonElement>('button.cash-modal-close:not(:disabled)')?.click();return;}
        if (quantityEditor) setQuantityEditor(null);
        else if (paymentModal) setPaymentModal(false);
        return;
      }
      if (event.key === "F2" && channel !== "official" && items.length && !paymentModal && !busy && !reservationBusy) {
        event.preventDefault();
        if (mode === "order") void submit(); else openPayment();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const total = useMemo(() => flavors.reduce((sum, flavor) => sum + flavor.base_price * (quantities[flavor.id] || 0), 0), [flavors, quantities]);
  const openCashSession = workspace?.sessions.find((session) => session.status === "open") || null;
  const draftStorageKey = openCashSession?.id ? cashDraftStorageKey(openCashSession.id) : "";
  useEffect(() => {
    if (!openCashSession?.id || hydratedDraftSession.current === openCashSession.id) return;
    hydratedDraftSession.current = openCashSession.id;
    const saved = sessionStorage.getItem(cashDraftStorageKey(openCashSession.id));
    if (!saved) return;
    try {
      const snapshot = JSON.parse(saved) as CashDraftSnapshot;
      if (!snapshot.draftKey || Date.now() - new Date(snapshot.updatedAt).getTime() > 30 * 60 * 1000) {
        sessionStorage.removeItem(cashDraftStorageKey(openCashSession.id));
        return;
      }
      setDraftKey(snapshot.draftKey); quantitiesRef.current = snapshot.quantities || {}; setQuantities(snapshot.quantities || {});
      setName(snapshot.name || ""); setPhone(snapshot.phone || ""); setNotes(snapshot.notes || "");
      setSauceChoices(snapshot.sauceChoices || {}); setDiscountKind(snapshot.discountKind || "none");
      setDiscountValue(snapshot.discountValue || "0"); setSelectedCustomer(snapshot.selectedCustomer || null);
      setManualRewardUnit(snapshot.manualRewardUnit || ""); setDigitalRewardUnit(snapshot.digitalRewardUnit || "");
      void requireSupabase().rpc("staff_set_cash_draft_reservation", {
        target_session_id: openCashSession.id,
        target_draft_key: snapshot.draftKey,
        requested_items: cashDraftRequestedItems(snapshot.quantities || {}),
      }).then(({ data, error }) => {
        if (error || !data?.accepted) {
          quantitiesRef.current = {}; setQuantities({});
          sessionStorage.removeItem(cashDraftStorageKey(openCashSession.id));
          setNotice("O estoque mudou e o pedido anterior não pôde ser recuperado. Monte o pedido novamente.");
        } else setNotice("Pedido em andamento recuperado.");
        void load();
      });
    } catch {
      sessionStorage.removeItem(cashDraftStorageKey(openCashSession.id));
    }
  }, [openCashSession?.id, load]);
  useEffect(() => {
    if (!draftStorageKey || hydratedDraftSession.current !== openCashSession?.id) return;
    const hasContent = Object.values(quantities).some((value) => value > 0);
    if (!hasContent) { sessionStorage.removeItem(draftStorageKey); return; }
    const snapshot: CashDraftSnapshot = { draftKey, quantities, name, phone, notes, sauceChoices, discountKind, discountValue, selectedCustomer, manualRewardUnit, digitalRewardUnit, updatedAt: new Date().toISOString() };
    sessionStorage.setItem(draftStorageKey, JSON.stringify(snapshot));
  }, [draftStorageKey, openCashSession?.id, draftKey, quantities, name, phone, notes, sauceChoices, discountKind, discountValue, selectedCustomer, manualRewardUnit, digitalRewardUnit]);
  useEffect(() => {
    if (!openCashSession?.id || hydratedDraftSession.current !== openCashSession.id) return;
    const renew = async () => {
      const requestedItems = cashDraftRequestedItems(quantitiesRef.current);
      if (!requestedItems.length || document.visibilityState !== "visible" || reservationLock.current || checkoutLock.current) return;
      const { data, error } = await requireSupabase().rpc("staff_set_cash_draft_reservation", { target_session_id: openCashSession.id, target_draft_key: draftKey, requested_items: requestedItems });
      if (error || !data?.accepted) {
        setNotice("A reserva deste pedido precisa ser atualizada. Confira as fatias antes de finalizar.");
        return;
      }
      const saved = sessionStorage.getItem(draftStorageKey);
      if (saved) {
        try {
          const snapshot = JSON.parse(saved) as CashDraftSnapshot;
          sessionStorage.setItem(draftStorageKey, JSON.stringify({ ...snapshot, updatedAt: new Date().toISOString() }));
        } catch {
          sessionStorage.removeItem(draftStorageKey);
        }
      }
    };
    const timer = window.setInterval(() => void renew(), 5 * 60 * 1000);
    const onFocus = () => void renew();
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [draftKey, draftStorageKey, openCashSession?.id]);
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
      const { data, error } = await requireSupabase().rpc("staff_set_cash_draft_reservation", { target_session_id: openCashSession.id, target_draft_key: draftKey, requested_items: cashDraftRequestedItems(nextQuantities) });
      if (error) throw error;
      if (!data?.accepted) throw new Error("Estoque insuficiente. Atualize os sabores disponíveis.");
      quantitiesRef.current = nextQuantities; setQuantities(nextQuantities);
      setSauceChoices((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${flavor.id}:`) || Number(key.split(":")[1]) <= next)));
    } catch (error) { setNotice(error instanceof Error ? error.message : String((error as {message?: string}).message || "Não foi possível reservar a fatia.")); }
    // Recarrega estoque/reservado/livre sempre, com sucesso ou erro: outro
    // atendente pode ter mexido no mesmo sabor entre o clique e a resposta,
    // e sem isso o número na tela ficava desatualizado e o clique parecia
    // "não fazer nada".
    finally { reservationLock.current = false; setReservationBusy(false); await load(); }
  };
  const cancelDraft = async (reason: string) => {
    if (reservationLock.current || busy) return;
    setBusy(true);
    try {
      if (openCashSession) { const {error} = await requireSupabase().rpc("staff_release_cash_draft_reservation", { target_session_id: openCashSession.id, target_draft_key: draftKey }); if (error) throw error; }
      if (draftStorageKey) sessionStorage.removeItem(draftStorageKey);
      quantitiesRef.current = {}; setQuantities({}); setSauceChoices({}); setName(""); setPhone(""); setNotes(""); setPrintReceipt(false); setDiscountKind("none"); setDiscountValue("0"); setDraftKey(crypto.randomUUID()); setCancelReasonOpen(false); setCancelReasonCustom(""); setNotice(`Pedido cancelado${reason ? ` (${reason})` : ""}. Estoque liberado.`); await load();
    } catch (error) { setNotice((error as Error).message); } finally { setBusy(false); }
  };
  const releaseOtherDrafts = async () => {
    if (!openCashSession || releaseBusy || busy) return;
    const confirmed = await confirmAction(
      "Liberar as reservas de outros carrinhos deste caixa? O pedido aberto nesta aba e os pedidos reais serão preservados.",
      { confirmLabel: "Liberar reservas" },
    );
    if (!confirmed) return;
    setReleaseBusy(true); setNotice("");
    try {
      const { data, error } = await requireSupabase().rpc("staff_release_other_cash_drafts", { target_session_id: openCashSession.id, preserved_draft_key: draftKey });
      if (error) throw error;
      const releasedSlices=Number(data?.released_slices||0),releasedDrafts=Number(data?.released_drafts||0);
      setNotice(releasedSlices ? `${releasedSlices} fatia(s) de ${releasedDrafts} carrinho(s) liberada(s). Este pedido foi preservado.` : "Nenhuma reserva de outro carrinho estava ativa. Este pedido foi preservado.");
      await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível liberar os outros carrinhos."); }
    finally { setReleaseBusy(false); }
  };
  const changeChannel = (next: ChannelMode) => {
    if (reservationLock.current || busy) return;
    if (Object.values(quantitiesRef.current).some(value => value > 0) && next !== channel) return setNotice("Conclua ou cancele o pedido antes de trocar o canal.");
    setChannel(next); setMode("sale"); localStorage.setItem("adoce-cash-channel", next); setNotice("");
  };
  const openCash = async () => {
    if (!registerId) return setNotice("Nenhum caixa ativo foi configurado para esta loja.");
    const initialAmount = centsToAmount(openingFloat);
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
  const totals = calculateTotals(cashLines, discount);
  const rewardOptions = rewardUnitOptions(cashLines.map((line) => ({ flavorId: line.flavorId, name: line.shortName, quantity: line.quantity })));
  const loyaltyState = resolveLoyaltyMode({ customerId: selectedCustomer?.profile_id || "", manualUnitKey: manualRewardUnit, digitalUnitKey: digitalRewardUnit });
  // Ex.: 13 carimbos + 2 fatias: a 1a paga completa o cartao e a 2a pode sair gratis agora.
  const rewardCompletesCard = Boolean(selectedCustomer && !selectedCustomer.available_rewards && itemCount >= 2
    && selectedCustomer.current_progress + (itemCount - 1) >= 14);
  const selectedRewardUnit = selectedCustomer ? digitalRewardUnit : loyaltyState.manualUnitKey;
  const selectedRewardLine = selectedRewardUnit ? cashLines.find((line) => line.flavorId === selectedRewardUnit.split(":")[0]) : undefined;
  const payableTotal = Math.max(0, totals.total - (selectedRewardLine ? Math.min(16, selectedRewardLine.unitPrice) : 0));
  useEffect(() => { if (selectedCustomer && manualRewardUnit) setManualRewardUnit(""); }, [manualRewardUnit, selectedCustomer]);
  // Na fidelidade o cliente só paga a diferença de sabores acima de R$ 16.
  const loyaltyCharge = cashLines.reduce((sum, line) => sum + Math.max(0, line.unitPrice - 16) * line.quantity, 0);
  const openPayment = () => {if(!busy && !reservationBusy){setNotice("");setPaymentModal(true);}};
  const submit = async (checkout?: CashCheckoutRequest) => {
    const payments = checkout?.payments || [];
    const saleMethod = checkout?.method || method;
    const deferred = Boolean(checkout?.deferred);
    const loyalty = Boolean(checkout?.loyalty || selectedRewardUnit);
    const legacyLoyalty = Boolean(checkout?.loyalty && !selectedRewardUnit);
    const saleName = checkout?.name ?? name;
    const clubName = name || checkout?.clubName || "";
    const clubPhone = phone || checkout?.clubPhone || "";
    const changePix = checkout?.changePix || 0;
    const changeSource = checkout?.changeSource || "Conta pessoal";
    const payrollEmployeeId = checkout?.payrollEmployeeId || null;
    const saleTotals = calculateTotals(cashLines, discount, payments);
    if (!items.length) return setNotice("Inclua pelo menos uma fatia.");
    if (!saleMethod) return setNotice("Escolha a forma de pagamento.");
    if (mode === "order" && sauces.length && items.some((item) => item.sauces?.some((choice) => !choice.sauce_id && (sauceChoices[`${item.flavor_id}:${choice.unit_number}`] || "none") !== "none"))) return setNotice("Escolha a calda de cada fatia.");
    if (mode === "order" && saleName.trim().split(/\s+/).length < 2) return setNotice("Informe o nome e sobrenome do cliente para registrar o pedido.");
    if (mode === "order" && phone.replace(/\D/g, "").length < 10) return setNotice("Informe o WhatsApp do cliente com DDD.");
    if (!openCashSession) return setNotice("Abra o caixa e informe o dinheiro inicial antes da primeira venda do dia.");
    if (reservationLock.current || checkoutLock.current || busy) return;
    if (deferred && !payments.length && validateDeferredSale(saleName)) return setNotice(validateDeferredSale(saleName));
    const clubError = mode === "sale" && !selectedCustomer ? enrollFieldsError(clubName, clubPhone) : "";
    if (legacyLoyalty && (deferred || payments.length)) return setNotice("Na fidelidade não há pagamento pendente nem pagamentos lançados. Remova-os.");
    if (manualRewardUnit && (selectedCustomer || canEnrollSaleCustomer(clubName, clubPhone))) { setManualRewardUnit(""); return setNotice("Ao identificar ou cadastrar o cliente, a fidelidade manual é desabilitada. Confirme novamente a venda pelo Clube Adoce."); }
    if (mode === "sale" && !deferred && !loyalty && saleTotals.remaining > 0) return setNotice("Adicione o restante ou escolha concluir com saldo pendente.");
    try { splitChange(saleTotals.change, changePix); } catch (error) { return setNotice((error as Error).message); }
    checkoutLock.current = true; setBusy(true); setNotice("");
    const shouldPrint = printReceipt;
    const paymentSummary = payments.length ? `Pagamento: ${payments.map((item) => `${item.method} ${money(item.amount)}`).join(" + ")}.` : "";
    const discountSummary = discount.kind !== "none" && discount.value > 0 ? `Desconto aplicado: ${discount.kind === "percent" ? `${discount.value}%` : money(discount.value)}.` : "";
    try {
      const result = selectedRewardUnit
        ? await requireSupabase().rpc("staff_finalize_cash_sale_with_customer", { target_session_id: openCashSession.id, target_draft_key: draftKey, requested_operation_key: draftKey, requested_customer_name: saleName || clubName, requested_customer_phone: clubPhone, requested_customer_profile_id: selectedCustomer?.profile_id || null, requested_customer_reward_id: selectedCustomer?.available_reward_id || null, requested_items: items, requested_reward_unit: selectedRewardUnit, requested_reward_kind: selectedCustomer ? (selectedCustomer.available_reward_id ? "digital" : "projected") : "manual", requested_payment_method: saleMethod, requested_discount: discount, requested_payments: payments, requested_change: { pix: changePix, source: changeSource }, requested_notes: [notes, discountSummary, paymentSummary].filter(Boolean).join(" ") })
        : mode === "order"
        ? await requireSupabase().rpc("staff_submit_cash_order_v1", { target_session_id: openCashSession.id, target_draft_key: draftKey, requested_customer_name: saleName, requested_customer_phone: phone, requested_items: items, requested_payment_method: saleMethod, requested_notes: [notes, discountSummary, paymentSummary].filter(Boolean).join(" "), requested_reward: null })
        : loyalty
          ? await requireSupabase().rpc("staff_create_loyalty_cash_sale", { target_session_id: openCashSession.id, target_draft_key: draftKey, requested_operation_key: draftKey, requested_customer_name: saleName, requested_items: items, requested_payment_method: loyaltyCharge > 0 ? saleMethod : null, requested_notes: notes })
        : deferred && payments.length
          ? await requireSupabase().rpc("staff_complete_partial_cash_sale", { target_draft_key: draftKey, requested_operation_key: draftKey, target_session_id: openCashSession.id, requested_customer_name: saleName, requested_customer_phone: phone, requested_items: items, requested_payment_method: saleMethod, requested_discount: discount, requested_payments: payments, requested_change: { pix: changePix, source: changeSource }, requested_notes: [notes, discountSummary, paymentSummary].filter(Boolean).join(" "), requested_payroll_employee_id: payrollEmployeeId })
          : deferred
            ? await requireSupabase().rpc("staff_create_deferred_cash_sale", { target_session_id: openCashSession.id, target_draft_key: draftKey, requested_operation_key: draftKey, requested_customer_name: saleName, requested_items: items, requested_discount: discount, requested_notes: notes })
            : await requireSupabase().rpc("staff_create_manual_sale_in_cash_v7", { target_draft_key: draftKey, requested_operation_key: draftKey, target_session_id: openCashSession.id, requested_customer_name: saleName, requested_customer_phone: phone, requested_items: items, requested_payment_method: saleMethod, requested_discount: discount, requested_payments: payments, requested_change: { pix: changePix, source: changeSource }, requested_notes: [notes, discountSummary, paymentSummary].filter(Boolean).join(" "), requested_payroll_employee_id: payrollEmployeeId });
      const { data, error } = result;
      if (error) throw error;
      if (mode === "order" && !data?.accepted) throw Error(data?.message || "Não foi possível registrar o pedido.");
      if (mode === "sale" && !deferred && !loyalty && (Number(data?.remaining || 0) > 0 || data?.completed === false)) throw Error("A venda foi registrada com saldo restante. Confira o pedido antes de iniciar outra venda.");
      if (mode === "sale" && !data?.order_id) throw Error("Não foi possível confirmar a venda. Tente novamente.");
      if (mode === "sale") {
        const completedOrder: ThermalOrder = {id:String(data.order_id),order_number:String(data.order_number || ""),customer_name:saleName,customer_phone:phone,total:Number(data.total ?? saleTotals.total),created_at:new Date().toISOString(),instant_order_items:cashLines.map(line=>({id:line.id,flavor_name:line.shortName,quantity:line.quantity,is_reward:loyalty})),payments:data.payment_allocations || payments};
        setLastSale(completedOrder); setPrintNotice(shouldPrint ? "Enviando cupom…" : "Venda finalizada sem impressão.");
        if (shouldPrint) void printCashSale(completedOrder.id).then(()=>setPrintNotice(`Cupom ${completedOrder.order_number} enviado para impressão.`)).catch(()=>setPrintNotice(`Cupom ${completedOrder.order_number} não enviado. Use Reimprimir vendas de hoje.`));
        const enroll = canEnrollSaleCustomer(clubName,clubPhone) && !data?.loyalty_recorded;
        setEnrollNotice(enroll ? "Cadastrando cliente e lançando carimbos…" : clubError ? `Venda concluída. Cadastro não realizado: ${clubError}` : "");
        if (enroll) void enrollSaleCustomer(completedOrder.id,clubName,clubPhone).then(result=>setEnrollNotice(enrollSummary(result))).catch((error:Error)=>setEnrollNotice(error.message));
      }
      // A próxima venda fica disponível assim que o banco confirma, sem esperar cupom ou cadastro.
      quantitiesRef.current = {}; setQuantities({}); setSauceChoices({}); setName(""); setPhone(""); setSelectedCustomer(null); setManualRewardUnit(""); setDigitalRewardUnit(""); setNotes("");
      setPrintReceipt(false); setDiscountKind("none"); setDiscountValue("0"); setDraftKey(crypto.randomUUID()); setPaymentModal(false);
      setNotice(mode === "order" ? `Pedido ${data.order_number || ""} entrou na fila para conferência.` : `Venda ${data.order_number || ""} finalizada.${saleTotals.change > 0 ? ` Troco: ${money(saleTotals.change)}.` : ""} Pronto para o próximo pedido.`);
      requestAnimationFrame(()=>flavorHeading.current?.scrollIntoView({block:"start",behavior:"instant"}));
      onCreated(); void load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String((error as {message?:string}).message || "Não foi possível finalizar. Confira a conexão e tente novamente."));
    } finally { checkoutLock.current = false; setBusy(false); }
  };
  return <section className="cash-register-page" aria-label="Caixa Adoce">
    {channel === "official" ? <div className="cash-official"><button type="button" className="commerce-secondary-action cash-official-back" onClick={() => changeChannel("presential")}><Store /> Voltar aos pedidos</button><WhatsAppSupportInbox /></div> : <><div className="cash-register-layout"><main><div className="cash-sale-heading"><h3 ref={flavorHeading} className="cash-flavors-title">Caixa</h3><CashCustomerSelector value={selectedCustomer} phone={phone} name={name} paidSlices={Math.max(0, itemCount - (selectedRewardUnit ? 1 : 0))} onSelect={setSelectedCustomer} onPhone={setPhone} onName={setName} /></div>
      {notice ? <p className="operation-commercial-notice">{notice}</p> : null}
      {!openCashSession ? <div className="manual-sale-cash-state-wrap"><section className="manual-sale-cash-state"><strong>Abra o caixa para começar as vendas de hoje</strong><p>Conte o dinheiro que está na gaveta e informe o valor. O comprovante de abertura sai na impressora do tablet.</p><label>Caixa<select value={registerId} onChange={(event) => setRegisterId(event.target.value)}>{activeRegisters.map((register) => <option key={register.id} value={register.id}>{register.name}</option>)}</select></label><label>Dinheiro inicial no caixa<input inputMode="numeric" value={centsToDisplay(openingFloat)} onChange={(event) => setOpeningFloat(centsDigits(event.target.value))} /></label><button className="commerce-secondary-action" type="button" onClick={() => void openCash()} disabled={busy || !registerId}>{busy ? "Abrindo…" : "Abrir caixa"}</button></section></div> : null}
      {openCashSession ? <><div className="cash-register-flavors" aria-busy={reservationBusy}>{flavors.map((flavor) => <article className="cash-flavor-card" key={flavor.id}><button type="button" disabled={reservationBusy || busy} onClick={() => void setQuantity(flavor, (quantities[flavor.id] || 0) + 1)}><strong>{flavor.short_name || flavor.name}</strong><small>{money(flavor.base_price)}</small><small>Estoque: {flavor.stock} | Reservado: {flavor.reserved} | Livre: {flavor.free}{(quantities[flavor.id] || 0) > 0 ? ` | Neste pedido: ${quantities[flavor.id]}` : ""}</small></button><div className="cash-flavor-qty"><button type="button" aria-label={`Diminuir ${flavor.short_name || flavor.name}`} disabled={reservationBusy || busy} onClick={() => void setQuantity(flavor, (quantities[flavor.id] || 0) - 1)}><Minus /></button><button type="button" className="cash-qty-value" aria-label={`Editar quantidade de ${flavor.short_name || flavor.name}`} onClick={() => { setQuantityEditor(flavor); setQuantityDraft(String(quantities[flavor.id] || 0)); }}>{quantities[flavor.id] || 0}</button><button type="button" aria-label={`Aumentar ${flavor.short_name || flavor.name}`} disabled={reservationBusy || busy} onClick={() => void setQuantity(flavor, (quantities[flavor.id] || 0) + 1)}><Plus /></button></div>{(quantities[flavor.id] || 0) > 0 && sauces.length ? <details className="cash-sauces"><summary>Caldas ({quantities[flavor.id]})</summary>{Array.from({length: quantities[flavor.id]}, (_, index) => <label key={index}>Fatia {index + 1}<select aria-label={`Calda ${index + 1} de ${flavor.short_name || flavor.name}`} value={sauceChoices[`${flavor.id}:${index + 1}`] || "none"} onChange={(event) => setSauceChoices(current => ({...current, [`${flavor.id}:${index + 1}`]: event.target.value}))}><option value="none">Sem calda</option>{sauces.map(sauce => <option key={sauce.id} value={sauce.id}>{sauce.name}</option>)}</select></label>)}</details> : null}</article>)}</div>
      {!flavors.length ? <div className="cash-empty-flavors" role="status"><strong>Nenhum sabor liberado para vender agora.</strong><p>Os sabores aparecem aqui quando estão como "Disponível" e com quantidade em Produtos → Disponibilidade.</p><button type="button" className="commerce-secondary-action" onClick={() => openOperationArea({ view: "products", contentTab: "today" })}>Liberar sabores de hoje</button></div> : null}</> : null}
    </main><aside className="cash-register-cart"><div className="cash-cart-heading"><strong><ShoppingBag /> Carrinho</strong><span>{itemCount} {itemCount === 1 ? "item" : "itens"}</span></div>{items.length ? items.map((item) => { const flavor = flavors.find((entry) => entry.id === item.flavor_id); return <div className="cash-cart-item" key={item.flavor_id}><span>{flavor?.short_name || flavor?.name}<small>{money((flavor?.base_price || 0) * item.quantity)}</small></span><b>{item.quantity}</b></div>; }) : <div className="cash-cart-empty"><ShoppingBag /><p>Seu carrinho está vazio.</p></div>}{selectedCustomer && (selectedCustomer.available_rewards || rewardCompletesCard) ? <label>{selectedCustomer.available_rewards ? "Fatia grátis do Clube" : "Esta compra completa o cartão: fatia grátis"}<select value={digitalRewardUnit} onChange={(event) => setDigitalRewardUnit(event.target.value)}><option value="">Não usar agora</option>{rewardOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label> : null}<label>Fidelidade manual<select disabled={loyaltyState.manualDisabled} value={loyaltyState.manualUnitKey} onChange={(event) => setManualRewardUnit(event.target.value)}><option value="">Não aplicar</option>{rewardOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select><small>{loyaltyState.manualDisabled ? "Desabilitada porque o cliente foi identificado no Clube Adoce." : "Use para o cartão de fidelidade externo."}</small></label><div className="cash-cart-total"><span>Total</span><strong>{money(payableTotal)}</strong></div><button type="button" className="cash-discount-link" onClick={() => setDiscountKind(discountKind === "none" ? "amount" : "none")}>Desconto <span>{discountKind === "none" ? money(0) : discountKind === "percent" ? `${discountValue}%` : money(discount.value) } ›</span></button>{discountKind !== "none" ? <div className="cash-discount-fields"><select value={discountKind} onChange={(event) => setDiscountKind(event.target.value as Discount["kind"])}><option value="amount">Valor</option><option value="percent">Percentual</option></select><input inputMode="decimal" value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} placeholder="0" /></div> : null}<div className="cash-cart-actions"><button className="commerce-secondary-action cash-cancel" type="button" onClick={() => setCancelReasonOpen(true)} disabled={busy || reservationBusy || !items.length}>Cancelar pedido</button><button className="commerce-primary-action cash-finish" type="button" onClick={openPayment} disabled={busy || reservationBusy || !items.length}>{busy ? "Registrando…" : "Finalizar venda"}</button></div><OperationWhatsAppAlerts onOpenInbox={() => changeChannel("official")} /></aside>{items.length ? <div className="cash-mobile-checkout"><span><strong>{money(payableTotal)}</strong><small>{itemCount} {itemCount === 1 ? "fatia" : "fatias"}</small></span><button type="button" onClick={openPayment} disabled={busy || reservationBusy}>Cobrar</button></div> : null}</div><section className="cash-online-orders"><h3>Pedidos online</h3><OperationInstantOrders /></section></>}
    {channel === "presential" && lastSale ? <div className="cash-last-actions"><span>Última venda: <strong>{lastSale.order_number}</strong></span><button type="button" onClick={()=>setCustomerOpen(true)}>Clube da última venda</button><button type="button" onClick={()=>openOperationArea({view:"attend",stampSale:{orderNumber:lastSale.order_number,quantity:paidSliceCount(lastSale)}})}>Lançar carimbos</button>{printNotice ? <p role="status">{printNotice}</p> : null}{enrollNotice ? <p role="status">{enrollNotice}</p> : null}</div> : null}
    <div className="cash-admin-menu"><CashAdjustments sessionId={openCashSession?.id} flavors={flavors.map((flavor) => ({ id: flavor.id, name: flavor.name, remaining: flavor.remaining - (quantities[flavor.id] || 0) }))} onChanged={() => { setNotice("Lançamento registrado no caixa."); void load(); }} /><CashSessionActions sessionId={openCashSession?.id} storeId={openCashSession?.store_id || selectedStore?.id} hasDraft={items.length > 0} onChanged={() => void load()} />{channel === "presential" ? <button type="button" className="cash-finished-reprint-link" disabled={busy || !(openCashSession?.register_id || registerId)} onClick={()=>setReprintOpen(true)}><Printer /> Reimprimir vendas</button> : null}{openCashSession ? <button type="button" className="commerce-secondary-action cash-release-other-drafts" disabled={releaseBusy||busy} onClick={()=>void releaseOtherDrafts()}>{releaseBusy?"Liberando…":"Liberar reservas de outros carrinhos"}</button> : null}</div>
    {quantityEditor ? <div className="cash-modal-backdrop"><div className="cash-modal cash-quantity-modal" role="dialog" aria-modal="true" aria-labelledby="cash-quantity-title"><button type="button" className="cash-modal-close" onClick={() => setQuantityEditor(null)} aria-label="Fechar teclado"><X /></button><h3 id="cash-quantity-title">Quantidade de {quantityEditor.short_name || quantityEditor.name}</h3><input inputMode="none" value={quantityDraft} onChange={(event) => setQuantityDraft(event.target.value.replace(/\D/g, ""))} /><div className="cash-keypad">{[1,2,3,4,5,6,7,8,9,0].map((key) => <button type="button" className={key === 0 ? "cash-keypad-zero" : ""} key={key} onClick={() => setQuantityDraft((value) => `${value}${key}`.replace(/^0+(?=\d)/, ""))}>{key}</button>)}<button type="button" onClick={() => setQuantityDraft(value => value.slice(0,-1))} aria-label="Apagar último dígito"><Delete /></button><button type="button" className="cash-keypad-confirm" aria-label="Confirmar quantidade" onClick={() => { if (quantityEditor) void setQuantity(quantityEditor, Number(quantityDraft) || 0); setQuantityEditor(null); }}><Check /></button></div></div></div> : null}
    {cancelReasonOpen ? <div className="cash-modal-backdrop"><div className="cash-modal cash-cancel-reason-modal" role="dialog" aria-modal="true" aria-labelledby="cash-cancel-reason-title"><button type="button" className="cash-modal-close" onClick={() => setCancelReasonOpen(false)} aria-label="Fechar" disabled={busy}><X /></button><h3 id="cash-cancel-reason-title">Por que cancelar este pedido?</h3><div className="cash-cancel-reason-options">{CANCEL_REASONS.map((reason) => <button type="button" key={reason} disabled={busy} onClick={() => void cancelDraft(reason)}>{reason}</button>)}</div><label>Outro motivo<input value={cancelReasonCustom} onChange={(event) => setCancelReasonCustom(event.target.value)} placeholder="Descreva o motivo" /></label><button type="button" className="commerce-secondary-action" disabled={busy || !cancelReasonCustom.trim()} onClick={() => void cancelDraft(cancelReasonCustom.trim())}>Cancelar com esse motivo</button></div></div> : null}
    {paymentModal ? <CashCheckoutDialog total={payableTotal} loyaltyCharge={loyaltyCharge} methods={methods} employees={payrollEmployees} pixKey={pixKey} busy={busy} notice={notice} printReceipt={printReceipt} onPrintChange={setPrintReceipt} onClose={()=>{if(!busy)setPaymentModal(false);}} onComplete={submit} /> : null}
    {reprintOpen && (openCashSession?.register_id || registerId) && (openCashSession?.store_id || selectedStore?.id) ? <CashReprintDialog registerId={openCashSession?.register_id || registerId} storeId={openCashSession?.store_id || selectedStore!.id} registerName={activeRegisters.find(register=>register.id===(openCashSession?.register_id || registerId))?.name || "Caixa"} onClose={()=>setReprintOpen(false)} /> : null}
    {customerOpen && lastSale ? <div className="cash-modal-backdrop cash-fast-backdrop"><div className="cash-modal cash-fast-modal" role="dialog" aria-modal="true" aria-labelledby="cash-club-last-title"><header className="cash-fast-heading"><h3 id="cash-club-last-title">Clube · {lastSale.order_number}</h3><button type="button" className="cash-modal-close" onClick={()=>setCustomerOpen(false)} aria-label="Fechar cadastro"><X /></button></header><CashCustomerRegistration orderId={lastSale.id} openInitially onEnrolled={message=>{setEnrollNotice(message);setCustomerOpen(false);}} /></div></div> : null}
  </section>;
}
