import { useState } from "react";
import { requireSupabase } from "./lib/supabase";
import { createStaffCustomer } from "./staff-create-customer";
import { enrollFieldsError, enrollSaleCustomer, enrollSummary } from "./sale-club-enroll";

// Cadastro rápido depois da venda. Com a venda em mãos (orderId), já lança os
// carimbos dela e envia as boas-vindas; sem venda, só cria o cadastro.
export default function CashCustomerRegistration({ orderId, onEnrolled }: { orderId?: string; onEnrolled?: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const register = async () => {
    const fieldError = enrollFieldsError(name, phone) || (!name.trim() || !phone.trim() ? "Informe nome, sobrenome e WhatsApp com DDD." : "");
    if (fieldError) { setMessage(fieldError); return; }
    setBusy(true); setMessage("");
    try {
      if (orderId) {
        const result = await enrollSaleCustomer(orderId, name, phone);
        const summary = enrollSummary(result);
        setOpen(false);
        if (onEnrolled) onEnrolled(summary); else setMessage(summary);
        return;
      }
      const { data } = await requireSupabase().auth.getSession();
      if (!data.session) throw new Error("Entre novamente na operação.");
      const customer = await createStaffCustomer(data.session.access_token, name, phone);
      setMessage(customer.existing ? "Este cliente já está cadastrado no Clube." : "Cliente cadastrado no Clube. Você já pode lançar os carimbos.");
      setOpen(false);
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  };
  return <section><p>Deseja cadastrar o cliente no Clube?</p><button type="button" onClick={() => setOpen(!open)}>Cadastrar cliente no Clube</button>{open ? <div><label>Nome e sobrenome<input autoComplete="name" value={name} onChange={event => setName(event.target.value)} /></label><label>WhatsApp com DDD<input type="tel" autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)} /></label><p>{orderId ? "Os carimbos desta venda entram na hora e o cliente recebe as boas-vindas pelo WhatsApp." : "Cadastre somente se o cliente desejar participar do Clube."}</p><button type="button" disabled={busy} onClick={() => void register()}>{busy ? "Cadastrando…" : "Confirmar cadastro"}</button></div> : null}{message ? <p role="status">{message}</p> : null}</section>;
}
