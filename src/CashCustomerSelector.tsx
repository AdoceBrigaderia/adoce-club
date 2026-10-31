import { useEffect, useMemo, useRef, useState } from "react";
import { requireSupabase } from "./lib/supabase";
import { customerMatchesQuery, normalizeCashPhone, shouldSearchCustomers, type CashCustomer } from "./cash-customer-selector";

export default function CashCustomerSelector({ value, phone, name, paidSlices, onSelect, onPhone, onName }: {
  value: CashCustomer | null; phone: string; name: string; paidSlices: number;
  onSelect: (customer: CashCustomer | null) => void; onPhone: (value: string) => void; onName: (value: string) => void;
}) {
  const [customers, setCustomers] = useState<CashCustomer[]>([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(-1);
  const requestSequence = useRef(0);
  const fullDirectory = useRef<CashCustomer[]>([]);
  useEffect(() => {
    let active = true;
    void requireSupabase().rpc("staff_list_cash_customers").then(({ data, error }) => {
      if (!active) return;
      setLoading(false);
      if (error) { setStatus("Não foi possível carregar a lista completa de clientes."); return; }
      const sorted = ((data || []) as CashCustomer[]).sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));
      fullDirectory.current = sorted; setCustomers(sorted);
    });
    return () => { active = false; };
  }, []);
  const digits = normalizeCashPhone(phone);
  const searchTerm = customerQuery.trim();
  useEffect(() => {
    if (value || !shouldSearchCustomers(searchTerm)) return;
    const sequence = ++requestSequence.current;
    const timer = window.setTimeout(() => {
      setStatus("Procurando no Clube Adoce…"); setLoading(true);
      void requireSupabase().rpc("staff_search_customers", { search_text: searchTerm }).then(({ data, error }) => {
        if (sequence !== requestSequence.current) return;
        setLoading(false);
        if (error) { setStatus("Não foi possível pesquisar agora."); return; }
        const foundCustomers = ((data || []) as CashCustomer[]).sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));
        setCustomers(foundCustomers);
        const exact = digits.length >= 12 ? foundCustomers.find((customer) => normalizeCashPhone(customer.phone_e164 || "") === digits) : null;
        if (exact) { onSelect(exact); onName(exact.full_name); onPhone(exact.phone_e164 || phone); setCustomerQuery(""); setOpen(false); setStatus("Cliente encontrado."); }
        else setStatus(foundCustomers.length ? `${foundCustomers.length} cliente(s) encontrado(s).` : "Nenhum cliente encontrado.");
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [digits, onName, onPhone, onSelect, phone, searchTerm, value]);
  const summary = useMemo(() => value ? `${value.current_progress} de 14 carimbos · ${value.available_rewards || 0} recompensa(s) · esta compra prevê ${paidSlices} carimbo(s)` : status, [paidSlices, status, value]);
  const customerLabel = (customer: CashCustomer) => `${customer.full_name}${customer.phone_e164 ? ` · final ${normalizeCashPhone(customer.phone_e164).slice(-4)}` : ""}`;
  const visibleCustomers = useMemo(() => searchTerm ? customers.filter((customer) => customerMatchesQuery(customer, searchTerm)) : customers, [customers, searchTerm]);
  const choose = (customer: CashCustomer) => { onSelect(customer); onPhone(customer.phone_e164 || ""); onName(customer.full_name); setCustomerQuery(""); setOpen(false); setActiveIndex(-1); setStatus("Cliente selecionado."); };
  return <div className="cash-customer-identification">
    <label className="cash-customer-combobox">Clube Adoce
      <input role="combobox" aria-expanded={open} aria-controls="cash-customer-options" aria-autocomplete="list" aria-activedescendant={activeIndex >= 0 ? `cash-customer-option-${visibleCustomers[activeIndex]?.profile_id}` : undefined} value={value ? customerLabel(value) : customerQuery} onFocus={() => setOpen(true)} onBlur={() => window.setTimeout(() => setOpen(false), 120)} onChange={(event) => { const next = event.target.value; setCustomerQuery(next); if (!next.trim()) setCustomers(fullDirectory.current); onSelect(null); setOpen(true); setActiveIndex(-1); }} onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActiveIndex((index) => Math.min(index + 1, visibleCustomers.length - 1)); } else if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); } else if (event.key === "Enter" && activeIndex >= 0 && visibleCustomers[activeIndex]) { event.preventDefault(); choose(visibleCustomers[activeIndex]); } else if (event.key === "Escape") setOpen(false); }} placeholder="Nome ou celular" autoComplete="off" />
      {open ? <div id="cash-customer-options" className="cash-customer-options" role="listbox">{loading ? <span className="cash-customer-option-state">Carregando clientes…</span> : visibleCustomers.length ? visibleCustomers.map((customer, index) => <button id={`cash-customer-option-${customer.profile_id}`} key={customer.profile_id} type="button" role="option" aria-selected={index === activeIndex} onMouseDown={(event) => { event.preventDefault(); choose(customer); }}><strong>{customer.full_name}</strong><small>{customer.phone_e164 ? `Celular final ${normalizeCashPhone(customer.phone_e164).slice(-4)}` : "Celular não informado"}</small></button>) : <span className="cash-customer-option-state">Nenhum cliente encontrado.</span>}</div> : null}
    </label>
    <label>Celular<input inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => { onSelect(null); onPhone(event.target.value); setCustomerQuery(event.target.value); setOpen(true); }} placeholder="DDD + número" /></label>
    <label>Nome e sobrenome<input autoComplete="name" value={name} onChange={(event) => { onSelect(null); onName(event.target.value); setCustomerQuery(event.target.value); setOpen(true); }} placeholder="Ex.: Maria da Silva" /></label>
    {summary ? <p role="status">{summary}</p> : null}
  </div>;
}
