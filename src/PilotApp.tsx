import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Gift, Heart, LogOut, Plus, Search, Share2, UserPlus } from "lucide-react";
import { requireSupabase } from "./lib/supabase";

type PilotCustomer = {
  customer_id: string;
  public_token: string;
  full_name: string;
  phone_digits?: string;
  current_progress: number;
  completed_cards: number;
  available_rewards: number;
  redeemed_rewards: number;
  updated_at?: string;
};

const operationKey = () => crypto.randomUUID();
const firstRow = (data: unknown): PilotCustomer | null =>
  Array.isArray(data) && data.length ? (data[0] as PilotCustomer) : null;

function PilotBrand() {
  return <div className="brand"><img src="/site/logo.webp" alt="Adoce Brigaderia"/><div><strong>Clube Adoce</strong><span>Piloto do festival</span></div></div>;
}

function FestivalStaff() {
  const [code, setCode] = useState(() => sessionStorage.getItem("adoce-festival-code") || "");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PilotCustomer[]>([]);
  const [selected, setSelected] = useState<PilotCustomer | null>(null);
  const [qty, setQty] = useState(1);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const saveCode = () => {
    sessionStorage.setItem("adoce-festival-code", code.trim());
    setMessage("Acesso salvo somente neste navegador.");
  };

  const call = async (fn: string, args: Record<string, unknown>) => {
    setBusy(true); setMessage("");
    try {
      const { data, error } = await requireSupabase().rpc(fn, args);
      if (error) throw error;
      return data;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível concluir.");
      return null;
    } finally { setBusy(false); }
  };

  const enroll = async (event: React.FormEvent) => {
    event.preventDefault();
    const data = await call("pilot_enroll_customer", {
      staff_code: code.trim(), customer_name: name, customer_phone: phone,
      operation_key: operationKey(),
    });
    const customer = firstRow(data);
    if (customer) {
      setSelected(customer); setName(""); setPhone("");
      setMessage("Cliente cadastrado. Agora confirme as fatias desta compra.");
    }
  };

  const search = async () => {
    const data = await call("pilot_search_customers", { staff_code: code.trim(), search_text: query });
    if (Array.isArray(data)) setResults(data as PilotCustomer[]);
  };

  const purchase = async () => {
    if (!selected) return;
    const data = await call("pilot_record_purchase", {
      staff_code: code.trim(), target_customer_id: selected.customer_id,
      quantity: qty, operation_key: operationKey(),
    });
    const customer = firstRow(data);
    if (customer) { setSelected(customer); setQty(1); setMessage("Carimbos registrados com sucesso."); }
  };

  const redeem = async () => {
    if (!selected || !confirm("Confirmar retirada de uma fatia premiada?")) return;
    const data = await call("pilot_redeem_reward", {
      staff_code: code.trim(), target_customer_id: selected.customer_id, operation_key: operationKey(),
    });
    const customer = firstRow(data);
    if (customer) { setSelected(customer); setMessage("Prêmio retirado. O cartão atual foi preservado."); }
  };

  const cardUrl = selected ? location.origin + location.pathname + "#cartao/" + selected.public_token : "";
  const share = async () => {
    if (!selected) return;
    const text = "Seu cartão do Clube Adoce: " + cardUrl;
    if (navigator.share) await navigator.share({ title: "Clube Adoce", text, url: cardUrl });
    else { await navigator.clipboard.writeText(text); setMessage("Link copiado."); }
  };

  return <main className="staff-page pilot-staff">
    <header className="staff-header"><PilotBrand/><span>Festival · Atendimento</span><button className="icon-button" onClick={()=>{sessionStorage.removeItem("adoce-festival-code");setCode("");}} aria-label="Limpar acesso"><LogOut/></button></header>
    <section className="service">
      <div className="pilot-access"><label>Chave temporária da equipe<input type="password" value={code} onChange={e=>setCode(e.target.value)} placeholder="Cole a chave recebida"/></label><button className="secondary" onClick={saveCode}>Ativar neste aparelho</button></div>
      <div className="service-head"><div><h1>Atendimento do festival</h1><p>Cadastre, localize e registre as fatias compradas.</p></div></div>
      <div className="pilot-grid">
        <form className="pilot-panel" onSubmit={enroll}><h2><UserPlus/> Novo cliente</h2><label>Nome<input value={name} onChange={e=>setName(e.target.value)} required/></label><label>Telefone<input value={phone} onChange={e=>setPhone(e.target.value)} inputMode="tel" required/></label><button className="primary" disabled={busy||!code} type="submit">Cadastrar cliente</button></form>
        <section className="pilot-panel"><h2><Search/> Cliente existente</h2><label>Nome ou telefone<input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();search();}}}/></label><button className="secondary" disabled={busy||!code} onClick={search}>Buscar</button><div className="pilot-results">{results.map(c=><button key={c.customer_id} onClick={()=>setSelected(c)}><strong>{c.full_name}</strong><span>{c.current_progress}/14 · {c.available_rewards} prêmio(s)</span></button>)}</div></section>
      </div>
      {selected && <section className="pilot-customer">
        <div><span>Cliente selecionado</span><h2>{selected.full_name}</h2><p>{selected.current_progress}/14 carimbos · {selected.available_rewards} prêmio(s) disponível(is) · {selected.completed_cards} cartão(ões) concluído(s)</p></div>
        <div className="pilot-stamps">{Array.from({length:14},(_,i)=><span className={i<selected.current_progress?"filled":""} key={i}><Heart/></span>)}</div>
        <div className="pilot-actions"><div className="stepper"><button onClick={()=>setQty(Math.max(1,qty-1))}>−</button><strong>{qty}</strong><button onClick={()=>setQty(qty+1)}>+</button></div><button className="primary" disabled={busy} onClick={purchase}><Plus/> Registrar fatias</button><button className="secondary" disabled={busy||selected.available_rewards<1} onClick={redeem}><Gift/> Retirar prêmio</button><button className="secondary" onClick={share}><Share2/> Enviar cartão</button><button className="secondary" onClick={()=>navigator.clipboard.writeText(cardUrl)}><Copy/> Copiar link</button></div>
      </section>}
      {message && <div className="pilot-message"><Check/>{message}</div>}
    </section>
  </main>;
}

function CustomerCard({ token }: { token: string }) {
  const [customer, setCustomer] = useState<PilotCustomer | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const { data, error } = await requireSupabase().rpc("pilot_get_card", { card_token: token });
    if (error) { setError("Cartão não encontrado."); return; }
    setCustomer(firstRow(data));
  }, [token]);

  useEffect(() => { load(); const timer=setInterval(load,10000); return()=>clearInterval(timer); }, [load]);
  const stamps = useMemo(()=>Array.from({length:14},(_,i)=>i),[]);

  if (error) return <main className="card-page pilot-card"><div className="pilot-card-state">{error}</div></main>;
  if (!customer) return <main className="card-page pilot-card"><div className="pilot-card-state">Carregando seu Clube Adoce…</div></main>;

  return <main className="card-page pilot-card">
    <header className="simple-header"><PilotBrand/><span>Atualização automática</span></header>
    <section className="wallet-card">
      <div className="card-photo"><img src="/site/hero-cake.webp" alt="Fatia de chocolate Adoce"/></div>
      <div className="card-title"><img src="/site/logo.webp" alt=""/><div><span>Clube</span><strong>Adoce</strong></div></div>
      <div className="member"><span>Membro</span><strong>{customer.full_name}</strong></div>
      <div className="balance"><strong>{customer.current_progress}</strong><span>de 14<br/>carimbos</span></div>
      <div className="stamps">{stamps.map(i=><span key={i} className={i<customer.current_progress?"filled":""}><Heart/></span>)}</div>
      <div className={"card-message "+(customer.available_rewards?"reward":"")}>{customer.available_rewards?<Gift/>:<Heart/>}<strong>{customer.available_rewards?customer.available_rewards+" prêmio(s) disponível(is)":14-customer.current_progress+" para a próxima fatia"}</strong></div>
    </section>
    <section className="pilot-summary"><div><span>Cartões concluídos</span><strong>{customer.completed_cards}</strong></div><div><span>Prêmios disponíveis</span><strong>{customer.available_rewards}</strong></div><div><span>Prêmios aproveitados</span><strong>{customer.redeemed_rewards}</strong></div></section>
    <p className="pilot-note">Piloto oficial do Clube Adoce. Apresente esta tela no atendimento. O prêmio pode ser retirado no seu tempo.</p>
  </main>;
}

export default function PilotApp({ token }: { token?: string }) {
  return token ? <CustomerCard token={token}/> : <FestivalStaff/>;
}