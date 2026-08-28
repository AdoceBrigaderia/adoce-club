import { useCallback, useEffect, useMemo, useState } from "react";
import { Minus, Plus, ShoppingBag, X } from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import "./operation-commerce-tools.css";

type Flavor = { id: string; name: string; base_price: number; remaining: number };
type Method = { code: string; label: string; active: boolean };
type Sauce = { id: string; name: string };
type EntryMode = "order" | "sale";
type BusinessWorkspace = {
  role: string;
  stores: Array<{ id: string; name: string; active: boolean }>;
  registers: Array<{ id: string; store_id: string; name: string; active: boolean }>;
  sessions: Array<{ id: string; store_id: string; register_id: string; status: string }>;
};
const dateKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date());
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function OperationManualSale({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false); const [flavors, setFlavors] = useState<Flavor[]>([]); const [methods, setMethods] = useState<Method[]>([]); const [sauces, setSauces] = useState<Sauce[]>([]);
  const [mode, setMode] = useState<EntryMode>("order");
  const [quantities, setQuantities] = useState<Record<string, number>>({}); const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  const [method, setMethod] = useState("pix"); const [notes, setNotes] = useState(""); const [sauceChoices, setSauceChoices] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState("");
  const [workspace, setWorkspace] = useState<BusinessWorkspace | null>(null); const [registerId, setRegisterId] = useState(""); const [openingFloat, setOpeningFloat] = useState("0");
  const load = useCallback(async () => {
    const [{ data: flavorData }, { data: availabilityData }, { data: settingsData }, { data: sauceData }, { data: workspaceData, error: workspaceError }] = await Promise.all([
      requireSupabase().from("flavors").select("id,name,base_price").eq("active", true).order("name"),
      requireSupabase().from("flavor_availability").select("flavor_id,status,quantity_available,quantity_reserved").eq("service_date", dateKey()),
      requireSupabase().rpc("staff_get_commerce_settings"),
      requireSupabase().from("order_sauces").select("id,name").eq("active", true).order("sort_order").order("name"),
      requireSupabase().rpc("staff_get_business_workspace"),
    ]);
    setFlavors((flavorData || []).map((flavor) => { const availability = availabilityData?.find((row) => row.flavor_id === flavor.id); return { id: flavor.id, name: flavor.name, base_price: Number(flavor.base_price), remaining: Math.max(0, Number(availability?.quantity_available || 0) - Number(availability?.quantity_reserved || 0)) }; }).filter((flavor) => flavor.remaining > 0));
    const activeMethods = ((settingsData?.payment_methods || []) as Method[]).filter((item) => item.active); setMethods(activeMethods); if (!activeMethods.some((item) => item.code === method)) setMethod(activeMethods[0]?.code || "");
    setSauces((sauceData || []) as Sauce[]);
    const nextWorkspace = workspaceData as BusinessWorkspace | null;
    if (workspaceError) setNotice(`Não foi possível carregar o caixa: ${workspaceError.message}`);
    setWorkspace(nextWorkspace);
    const activeRegisters = (nextWorkspace?.registers || []).filter((item) => item.active);
    if (!activeRegisters.some((item) => item.id === registerId)) setRegisterId(activeRegisters[0]?.id || "");
  }, [method, registerId]);
  useEffect(() => { if (open) void load(); }, [open, load]);
  const items = useMemo(() => flavors.filter((flavor) => (quantities[flavor.id] || 0) > 0).map((flavor) => ({
    flavor_id: flavor.id,
    quantity: quantities[flavor.id],
    ...(mode === "order" && sauces.length ? { sauces: Array.from({ length: quantities[flavor.id] }, (_, index) => ({ unit_number: index + 1, sauce_id: sauceChoices[`${flavor.id}:${index + 1}`] === "none" ? null : sauceChoices[`${flavor.id}:${index + 1}`] })) } : {}),
  })), [flavors, quantities, sauceChoices, sauces.length, mode]);
  const total = useMemo(() => flavors.reduce((sum, flavor) => sum + flavor.base_price * (quantities[flavor.id] || 0), 0), [flavors, quantities]);
  const openCashSession = workspace?.sessions.find((session) => session.status === "open") || null;
  const activeStores = (workspace?.stores || []).filter((store) => store.active);
  const activeRegisters = (workspace?.registers || []).filter((register) => register.active);
  const selectedRegister = activeRegisters.find((register) => register.id === registerId);
  const selectedStore = activeStores.find((store) => store.id === selectedRegister?.store_id) || activeStores[0];
  const canReconcileWithoutOpenCash = workspace?.role === "owner" || workspace?.role === "manager";
  const setQuantity = (flavor: Flavor, value: number) => {
    const next = Math.max(0, Math.min(flavor.remaining, value));
    setQuantities((current) => ({ ...current, [flavor.id]: next }));
    setSauceChoices((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${flavor.id}:`) || Number(key.split(":")[1]) <= next)));
  };
  const openCash = async () => {
    if (!registerId) return setNotice("Nenhum caixa ativo foi configurado para esta loja.");
    const initialAmount = Number(openingFloat.replace(",", "."));
    if (!Number.isFinite(initialAmount) || initialAmount < 0) return setNotice("Informe um valor inicial válido para abrir o caixa.");
    setBusy(true); setNotice("");
    const { error } = await requireSupabase().rpc("staff_open_cash_session", { target_register_id: registerId, next_opening_float: initialAmount, next_notes: "Caixa aberto pela tela de venda direta." });
    setBusy(false);
    if (error) return setNotice(error.message);
    setNotice("Caixa aberto. Agora você pode confirmar a venda e baixar o estoque.");
    await load();
  };
  const submit = async () => {
    if (!items.length) return setNotice("Inclua pelo menos uma fatia."); if (!method) return setNotice("Escolha a forma de pagamento.");
    if (mode === "order" && sauces.length && items.some((item) => item.sauces?.some((choice) => !choice.sauce_id && sauceChoices[`${item.flavor_id}:${choice.unit_number}`] !== "none"))) return setNotice("Escolha a calda de cada fatia.");
    if (mode === "order" && name.trim().split(/\s+/).length < 2) return setNotice("Informe o nome e sobrenome do cliente para registrar o pedido.");
    if (mode === "order" && phone.replace(/\D/g, "").length < 10) return setNotice("Informe o WhatsApp do cliente com DDD.");
    if (mode === "sale" && !openCashSession && (!canReconcileWithoutOpenCash || !selectedStore)) return setNotice("Nenhum caixa está aberto. Abra o caixa antes de baixar esta venda.");
    setBusy(true);
    const operationKey = crypto.randomUUID();
    const result = mode === "order"
      ? await requireSupabase().rpc("staff_submit_instant_order_v5", { requested_customer_name: name, requested_customer_phone: phone, requested_items: items, requested_payment_method: method, requested_notes: notes, requested_reward: null })
      : openCashSession
        ? await requireSupabase().rpc("staff_create_manual_sale_in_cash_v2", { requested_operation_key: operationKey, target_session_id: openCashSession.id, requested_customer_name: name, requested_customer_phone: phone, requested_items: items, requested_payment_method: method, requested_notes: notes })
        : await requireSupabase().rpc("manager_create_manual_sale_for_reconciliation", { target_store_id: selectedStore!.id, requested_customer_name: name, requested_customer_phone: phone, requested_items: items, requested_payment_method: method, operation_key: operationKey, requested_notes: notes, reconciliation_reason: "Venda concluída antes da abertura do caixa" });
    const { data, error } = result; setBusy(false);
    if (error) return setNotice(error.message);
    if (mode === "order" && !data?.accepted) return setNotice(data?.message || "Não foi possível registrar o pedido.");
    setNotice(mode === "order" ? `Pedido ${data?.order_number || ""} entrou na fila para conferência.` : openCashSession ? `Venda ${data?.order_number || ""} registrada, estoque atualizado e pagamento contabilizado.` : `Venda ${data?.order_number || ""} baixada no estoque e enviada para conciliação do caixa.`); setQuantities({}); setSauceChoices({}); setName(""); setPhone(""); setNotes(""); onCreated();
  };
  return <>
    <div className="operation-manual-entry-actions">
      <button className="commerce-primary-action" type="button" onClick={() => { setMode("order"); setNotice(""); setOpen(true); }}><ShoppingBag /> Registrar pedido recebido no WhatsApp</button>
      <button className="commerce-secondary-action" type="button" onClick={() => { setMode("sale"); setNotice(""); setOpen(true); }}><ShoppingBag /> Lançar venda já concluída</button>
    </div>
    <p className="operation-whatsapp-order-guidance">Mensagens recebidas diretamente no WhatsApp não entram sozinhas na fila. Use “Registrar pedido recebido no WhatsApp” para acompanhar o atendimento até a retirada.</p>
    {open ? <div className="instant-order-operation-layer"><button className="instant-order-operation-backdrop" aria-label="Fechar" onClick={() => setOpen(false)} /><aside role="dialog" aria-modal="true" aria-label={mode === "order" ? "Registrar pedido do WhatsApp" : "Lançar venda"}><button className="drawer-close" onClick={() => setOpen(false)} aria-label="Fechar"><X /></button><small>{mode === "order" ? "Pedido recebido no WhatsApp" : "Venda direta"}</small><h2>{mode === "order" ? "Registrar pedido" : "Lançar venda"}</h2><p>{mode === "order" ? "O pedido entra em Para conferir e continua nesta fila até a retirada." : "Use quando o pagamento e a entrega já foram concluídos no atendimento."}</p>
      {notice ? <p className="operation-commercial-notice">{notice}</p> : null}
      {mode === "sale" && !openCashSession ? <section className="manual-sale-cash-state"><strong>Caixa fechado</strong><p>Você pode abrir o caixa agora. Se esta venda já aconteceu, proprietários e gerentes também podem baixá-la e deixá-la pendente de conciliação.</p><label>Caixa<select value={registerId} onChange={(event) => setRegisterId(event.target.value)}>{activeRegisters.map((register) => <option key={register.id} value={register.id}>{register.name}</option>)}</select></label><label>Dinheiro inicial no caixa<input inputMode="decimal" value={openingFloat} onChange={(event) => setOpeningFloat(event.target.value)} /></label><button className="commerce-secondary-action" type="button" onClick={() => void openCash()} disabled={busy || !registerId}>{busy ? "Abrindo…" : "Abrir caixa"}</button></section> : null}
      <div className="instant-order-operation-items">{flavors.map((flavor) => <div className="manual-sale-flavor" key={flavor.id}><span className="manual-sale-flavor-row"><span><strong>{flavor.name}</strong><small>{flavor.remaining} disponível(is) · {money(flavor.base_price)}</small></span><span><button type="button" onClick={() => setQuantity(flavor, (quantities[flavor.id] || 0) - 1)}><Minus /></button><b>{quantities[flavor.id] || 0}</b><button type="button" onClick={() => setQuantity(flavor, (quantities[flavor.id] || 0) + 1)}><Plus /></button></span></span>{mode === "order" && sauces.length && (quantities[flavor.id] || 0) > 0 ? <div className="manual-sale-sauce-choices">{Array.from({ length: quantities[flavor.id] || 0 }, (_, index) => { const unit = index + 1; const key = `${flavor.id}:${unit}`; return <label key={key}>{quantities[flavor.id] > 1 ? `Calda da ${unit}ª fatia` : "Calda"}<select value={sauceChoices[key] || ""} onChange={(event) => setSauceChoices((current) => ({ ...current, [key]: event.target.value }))}><option value="">Escolha a calda</option><option value="none">Sem calda</option>{sauces.map((sauce) => <option key={sauce.id} value={sauce.id}>{sauce.name}</option>)}</select></label>; })}</div> : null}</div>)}</div>
      <div className="instant-order-operation-total"><span>Total</span><strong>{money(total)}</strong></div>
      <label>Nome do cliente <small>{mode === "order" ? "(nome e sobrenome)" : "(opcional)"}</small><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Maria da Silva" /></label>
      <label>Celular <small>{mode === "order" ? "(WhatsApp com DDD)" : "(opcional; reconhece o Clube Adoce)"}</small><input inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="DDD + número" /></label>
      <label>Forma de pagamento<select value={method} onChange={(event) => setMethod(event.target.value)}>{methods.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></label>
      <label>Observações<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Informações úteis sobre a venda" /></label>
      <button className="commerce-primary-action" type="button" onClick={() => void submit()} disabled={busy}>{busy ? "Registrando…" : mode === "order" ? "Registrar e colocar em Para conferir" : openCashSession ? "Confirmar venda e baixar estoque" : canReconcileWithoutOpenCash ? "Baixar venda e enviar para conciliação" : "Abra o caixa para continuar"}</button>
    </aside></div> : null}
  </>;
}
