import { useState } from "react";
import { requireSupabase } from "./lib/supabase";
import { createStaffCustomer } from "./staff-create-customer";

export default function CashCustomerRegistration() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const register = async () => {
    setBusy(true); setMessage("");
    try {
      const { data } = await requireSupabase().auth.getSession();
      if (!data.session) throw new Error("Entre novamente na operação.");
      const customer = await createStaffCustomer(data.session.access_token, name, phone);
      setMessage(customer.existing ? "Este cliente já está cadastrado no Clube." : "Cliente cadastrado no Clube. Você já pode lançar os carimbos.");
      setOpen(false);
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  };
  return <section><p>Deseja cadastrar o cliente no Clube?</p><button type="button" onClick={() => setOpen(!open)}>Cadastrar cliente no Clube</button>{open ? <div><label>Nome e sobrenome<input autoComplete="name" value={name} onChange={event => setName(event.target.value)} /></label><label>WhatsApp com DDD<input type="tel" autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)} /></label><p>Cadastre somente se o cliente desejar participar do Clube.</p><button type="button" disabled={busy} onClick={() => void register()}>{busy ? "Cadastrando…" : "Confirmar cadastro"}</button></div> : null}{message ? <p role="status">{message}</p> : null}</section>;
}
