import { useEffect, useMemo, useState } from "react";
import { requireSupabase } from "./lib/supabase";
import { normalizeCashPhone, type CashCustomer } from "./cash-customer-selector";

export default function CashCustomerSelector({ value, phone, name, paidSlices, onSelect, onPhone, onName }: {
  value: CashCustomer | null;
  phone: string;
  name: string;
  paidSlices: number;
  onSelect: (customer: CashCustomer | null) => void;
  onPhone: (value: string) => void;
  onName: (value: string) => void;
}) {
  const [customers, setCustomers] = useState<CashCustomer[]>([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [status, setStatus] = useState("");
  useEffect(() => {
    let active = true;
    void requireSupabase().rpc("staff_list_cash_customers").then(({ data, error }) => {
      if (error) {
        if (active) setStatus("Não foi possível carregar a lista completa de clientes.");
        return;
      }
      if (active) setCustomers(((data || []) as CashCustomer[]).sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR")));
    });
    return () => { active = false; };
  }, []);
  const digits = normalizeCashPhone(phone);
  useEffect(() => {
    if (value || digits.length < 12) return;
    const timer = window.setTimeout(() => {
      setStatus("Procurando no Clube Adoce…");
      void requireSupabase().rpc("staff_search_customers", { search_text: digits }).then(({ data, error }) => {
        if (error) { setStatus("Não foi possível pesquisar agora."); return; }
        const found = ((data || []) as CashCustomer[]).find((customer) => normalizeCashPhone(customer.phone_e164 || "") === digits);
        if (found) { onSelect(found); onName(found.full_name); onPhone(found.phone_e164 || phone); setStatus("Cliente encontrado."); }
        else setStatus("Cliente novo: informe também o nome e sobrenome.");
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [digits, onName, onPhone, onSelect, phone, value]);
  const summary = useMemo(() => value ? `${value.current_progress} de 14 carimbos · ${value.available_rewards || 0} recompensa(s) · esta compra prevê ${paidSlices} carimbo(s)` : status, [paidSlices, status, value]);
  const customerLabel = (customer: CashCustomer) => {
    const digits = normalizeCashPhone(customer.phone_e164 || "");
    return `${customer.full_name}${digits ? ` · final ${digits.slice(-4)}` : ""}`;
  };
  return <fieldset className="cash-customer-identification"><legend>Identificação do cliente</legend>
    <label>Clube Adoce<input list="cash-customer-options" value={value ? customerLabel(value) : customerQuery} onChange={(event) => { const next = event.target.value; setCustomerQuery(next); const customer = customers.find((item) => customerLabel(item) === next) || null; onSelect(customer); if (customer) { onPhone(customer.phone_e164 || ""); onName(customer.full_name); setStatus("Cliente selecionado."); } }} placeholder="Buscar cliente pelo nome ou final do celular" autoComplete="off" /><datalist id="cash-customer-options">{customers.map((customer) => <option key={customer.profile_id} value={customerLabel(customer)} />)}</datalist></label>
    <label>Celular <small>(opcional)</small><input inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => { onSelect(null); onPhone(event.target.value); }} placeholder="DDD + número" /></label>
    <label>Nome e sobrenome <small>(opcional)</small><input autoComplete="name" value={name} onChange={(event) => onName(event.target.value)} placeholder="Ex.: Maria da Silva" /></label>
    {summary ? <p role="status">{summary}</p> : null}
  </fieldset>;
}
