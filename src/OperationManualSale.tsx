import { useCallback, useEffect, useMemo, useState } from "react";
import { Minus, Plus, ShoppingBag, X } from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import "./operation-commerce-tools.css";

type Flavor = { id: string; name: string; base_price: number; remaining: number };
type Method = { code: string; label: string; active: boolean };
const dateKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date());
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function OperationManualSale({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false); const [flavors, setFlavors] = useState<Flavor[]>([]); const [methods, setMethods] = useState<Method[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({}); const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  const [method, setMethod] = useState("pix"); const [notes, setNotes] = useState(""); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    const [{ data: flavorData }, { data: availabilityData }, { data: settingsData }] = await Promise.all([
      requireSupabase().from("flavors").select("id,name,base_price").eq("active", true).order("name"),
      requireSupabase().from("flavor_availability").select("flavor_id,status,quantity_available,quantity_reserved").eq("service_date", dateKey()),
      requireSupabase().rpc("staff_get_commerce_settings"),
    ]);
    setFlavors((flavorData || []).map((flavor) => { const availability = availabilityData?.find((row) => row.flavor_id === flavor.id); return { id: flavor.id, name: flavor.name, base_price: Number(flavor.base_price), remaining: Math.max(0, Number(availability?.quantity_available || 0) - Number(availability?.quantity_reserved || 0)) }; }).filter((flavor) => flavor.remaining > 0));
    const activeMethods = ((settingsData?.payment_methods || []) as Method[]).filter((item) => item.active); setMethods(activeMethods); if (!activeMethods.some((item) => item.code === method)) setMethod(activeMethods[0]?.code || "");
  }, [method]);
  useEffect(() => { if (open) void load(); }, [open, load]);
  const items = useMemo(() => flavors.filter((flavor) => (quantities[flavor.id] || 0) > 0).map((flavor) => ({ flavor_id: flavor.id, quantity: quantities[flavor.id] })), [flavors, quantities]);
  const total = useMemo(() => flavors.reduce((sum, flavor) => sum + flavor.base_price * (quantities[flavor.id] || 0), 0), [flavors, quantities]);
  const setQuantity = (flavor: Flavor, value: number) => setQuantities((current) => ({ ...current, [flavor.id]: Math.max(0, Math.min(flavor.remaining, value)) }));
  const submit = async () => {
    if (!items.length) return setNotice("Inclua pelo menos uma fatia na venda."); if (!method) return setNotice("Escolha a forma de pagamento.");
    setBusy(true); const { data, error } = await requireSupabase().rpc("staff_create_manual_sale", { requested_customer_name: name, requested_customer_phone: phone, requested_items: items, requested_payment_method: method, requested_notes: notes }); setBusy(false);
    if (error) return setNotice(error.message);
    setNotice(`Venda ${data?.order_number || ""} registrada, estoque atualizado e pagamento contabilizado.`); setQuantities({}); setName(""); setPhone(""); setNotes(""); onCreated();
  };
  return <>
    <button className="commerce-primary-action" type="button" onClick={() => setOpen(true)}><ShoppingBag /> Lançar venda do atendimento</button>
    {open ? <div className="instant-order-operation-layer"><button className="instant-order-operation-backdrop" aria-label="Fechar" onClick={() => setOpen(false)} /><aside role="dialog" aria-modal="true" aria-label="Lançar venda"><button className="drawer-close" onClick={() => setOpen(false)} aria-label="Fechar"><X /></button><small>Venda direta</small><h2>Lançar venda</h2><p>Use para balcão, WhatsApp ou atendimento presencial. Não é necessário cadastrar o cliente.</p>
      {notice ? <p className="operation-commercial-notice">{notice}</p> : null}
      <div className="instant-order-operation-items">{flavors.map((flavor) => <span key={flavor.id}><span><strong>{flavor.name}</strong><small>{flavor.remaining} disponível(is) · {money(flavor.base_price)}</small></span><span><button type="button" onClick={() => setQuantity(flavor, (quantities[flavor.id] || 0) - 1)}><Minus /></button><b>{quantities[flavor.id] || 0}</b><button type="button" onClick={() => setQuantity(flavor, (quantities[flavor.id] || 0) + 1)}><Plus /></button></span></span>)}</div>
      <div className="instant-order-operation-total"><span>Total</span><strong>{money(total)}</strong></div>
      <label>Nome do cliente <small>(opcional)</small><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Cliente do atendimento" /></label>
      <label>Celular <small>(opcional; reconhece o Clube Adoce)</small><input inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="DDD + número" /></label>
      <label>Forma de pagamento<select value={method} onChange={(event) => setMethod(event.target.value)}>{methods.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></label>
      <label>Observações<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Informações úteis sobre a venda" /></label>
      <button className="commerce-primary-action" type="button" onClick={() => void submit()} disabled={busy}>{busy ? "Registrando…" : "Confirmar venda e baixar estoque"}</button>
    </aside></div> : null}
  </>;
}
