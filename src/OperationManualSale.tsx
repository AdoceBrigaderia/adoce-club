import { useCallback, useEffect, useMemo, useState } from "react";
import { LockKeyhole, Minus, Plus, ShoppingBag, X } from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import "./operation-commerce-tools.css";

type Flavor = { id: string; name: string; base_price: number; remaining: number };
type Method = { code: string; label: string; active: boolean };
type OpenCashSession = { id: string; store_id: string; register_id: string; status: string; opened_at: string };
type CashRegister = { id: string; store_id: string; name: string; active: boolean };
type StoreRow = { id: string; name: string; active: boolean };
type CashWorkspace = { sessions?: OpenCashSession[]; registers?: CashRegister[]; stores?: StoreRow[] };
const dateKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date());
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function OperationManualSale({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false); const [flavors, setFlavors] = useState<Flavor[]>([]); const [methods, setMethods] = useState<Method[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({}); const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  const [method, setMethod] = useState("pix"); const [notes, setNotes] = useState(""); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState("");
  const [cashSessions, setCashSessions] = useState<OpenCashSession[]>([]); const [registers, setRegisters] = useState<CashRegister[]>([]); const [stores, setStores] = useState<StoreRow[]>([]); const [cashSessionId, setCashSessionId] = useState("");
  const load = useCallback(async () => {
    const [{ data: flavorData }, { data: availabilityData }, { data: settingsData }, { data: workspaceData, error: workspaceError }] = await Promise.all([
      requireSupabase().from("flavors").select("id,name,base_price").eq("active", true).order("name"),
      requireSupabase().from("flavor_availability").select("flavor_id,status,quantity_available,quantity_reserved").eq("service_date", dateKey()),
      requireSupabase().rpc("staff_get_commerce_settings"),
      requireSupabase().rpc("staff_get_business_workspace"),
    ]);
    setFlavors((flavorData || []).map((flavor) => { const availability = availabilityData?.find((row) => row.flavor_id === flavor.id); return { id: flavor.id, name: flavor.name, base_price: Number(flavor.base_price), remaining: Math.max(0, Number(availability?.quantity_available || 0) - Number(availability?.quantity_reserved || 0)) }; }).filter((flavor) => flavor.remaining > 0));
    const activeMethods = ((settingsData?.payment_methods || []) as Method[]).filter((item) => item.active); setMethods(activeMethods); if (!activeMethods.some((item) => item.code === method)) setMethod(activeMethods[0]?.code || "");
    if (workspaceError) { setNotice(workspaceError.message); return; }
    const workspace = (workspaceData || {}) as CashWorkspace;
    const opened = (workspace.sessions || []).filter((item) => item.status === "open");
    setCashSessions(opened); setRegisters(workspace.registers || []); setStores(workspace.stores || []);
    setCashSessionId((current) => opened.some((item) => item.id === current) ? current : (opened[0]?.id || ""));
    if (!opened.length) setNotice("Abra um caixa em Configurações antes de lançar uma venda presencial.");
  }, [method]);
  useEffect(() => { if (open) void load(); }, [open, load]);
  const items = useMemo(() => flavors.filter((flavor) => (quantities[flavor.id] || 0) > 0).map((flavor) => ({ flavor_id: flavor.id, quantity: quantities[flavor.id] })), [flavors, quantities]);
  const total = useMemo(() => flavors.reduce((sum, flavor) => sum + flavor.base_price * (quantities[flavor.id] || 0), 0), [flavors, quantities]);
  const setQuantity = (flavor: Flavor, value: number) => setQuantities((current) => ({ ...current, [flavor.id]: Math.max(0, Math.min(flavor.remaining, value)) }));
  const cashSessionLabel = (cash: OpenCashSession) => {
    const register = registers.find((item) => item.id === cash.register_id);
    const store = stores.find((item) => item.id === cash.store_id);
    return `${store?.name || "Loja"} · ${register?.name || "Caixa"}`;
  };
  const submit = async () => {
    if (!cashSessionId) return setNotice("Abra e selecione um caixa antes de registrar a venda."); if (!items.length) return setNotice("Inclua pelo menos uma fatia na venda."); if (!method) return setNotice("Escolha a forma de pagamento.");
    setBusy(true); const { data, error } = await requireSupabase().rpc("staff_create_manual_sale_in_cash", { target_session_id: cashSessionId, requested_customer_name: name, requested_customer_phone: phone, requested_items: items, requested_payment_method: method, requested_notes: notes }); setBusy(false);
    if (error) return setNotice(error.message);
    setNotice(`Venda ${data?.order_number || ""} registrada no caixa, estoque atualizado e pagamento contabilizado.`); setQuantities({}); setName(""); setPhone(""); setNotes(""); onCreated();
  };
  return <>
    <button className="commerce-primary-action" type="button" onClick={() => setOpen(true)}><ShoppingBag /> Lançar venda do atendimento</button>
    {open ? <div className="instant-order-operation-layer"><button className="instant-order-operation-backdrop" aria-label="Fechar" onClick={() => setOpen(false)} /><aside role="dialog" aria-modal="true" aria-label="Lançar venda"><button className="drawer-close" onClick={() => setOpen(false)} aria-label="Fechar"><X /></button><small>Venda direta</small><h2>Lançar venda</h2><p>Use para balcão, WhatsApp ou atendimento presencial. A venda será vinculada ao caixa aberto.</p>
      {notice ? <p className="operation-commercial-notice">{notice}</p> : null}
      <label>Caixa da venda<select value={cashSessionId} onChange={(event) => { setCashSessionId(event.target.value); setNotice(""); }}><option value="">Selecione um caixa aberto</option>{cashSessions.map((cash) => <option value={cash.id} key={cash.id}>{cashSessionLabel(cash)}</option>)}</select></label>
      {!cashSessions.length ? <div className="manual-sale-cash-warning"><LockKeyhole /><span><strong>Nenhum caixa aberto</strong><small>Abra o caixa em Configurações → Lojas, caixas, equipe e permissões.</small></span></div> : null}
      <div className="instant-order-operation-items">{flavors.map((flavor) => <span key={flavor.id}><span><strong>{flavor.name}</strong><small>{flavor.remaining} disponível(is) · {money(flavor.base_price)}</small></span><span><button type="button" onClick={() => setQuantity(flavor, (quantities[flavor.id] || 0) - 1)}><Minus /></button><b>{quantities[flavor.id] || 0}</b><button type="button" onClick={() => setQuantity(flavor, (quantities[flavor.id] || 0) + 1)}><Plus /></button></span></span>)}</div>
      <div className="instant-order-operation-total"><span>Total</span><strong>{money(total)}</strong></div>
      <label>Nome do cliente <small>(opcional)</small><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Cliente do atendimento" /></label>
      <label>Celular <small>(opcional; reconhece o Clube Adoce)</small><input inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="DDD + número" /></label>
      <label>Forma de pagamento<select value={method} onChange={(event) => setMethod(event.target.value)}>{methods.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></label>
      <label>Observações<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Informações úteis sobre a venda" /></label>
      <button className="commerce-primary-action" type="button" onClick={() => void submit()} disabled={busy || !cashSessionId}>{busy ? "Registrando…" : cashSessionId ? "Confirmar venda e baixar estoque" : "Abra o caixa para vender"}</button>
    </aside></div> : null}
  </>;
}
