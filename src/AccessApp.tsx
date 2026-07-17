import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { ArrowRight, Check, Gift, Heart, History, LogOut, Mail, Plus, Search, ShieldCheck, Smartphone, Sparkles, UserRound, Users } from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import { requestEmailCode, signOut, verifyEmailCode } from "./services/auth";
import "./access-app.css";

type Surface = "client" | "operation";
type AuthStage = "identify" | "code";

type CustomerSnapshot = {
  profile_id: string;
  account_id: string;
  full_name: string;
  phone_e164: string | null;
  email: string | null;
  current_progress: number;
  completed_cards: number;
  available_rewards: number;
  available_reward_id: string | null;
};

type ClubSnapshot = {
  name: string;
  progress: number;
  completed: number;
  rewards: number;
  referralProgress: number;
  referralRewards: number;
  referralCode: string;
};

function Brand({ label }: { label: string }) {
  return <a className="access-brand" href="/"><img src="/site/logo.webp" alt="Adoce Brigaderia"/><span><strong>{label}</strong><small>Adoce Brigaderia</small></span></a>;
}

function AuthScreen({ surface }: { surface: Surface }) {
  const [stage, setStage] = useState<AuthStage>("identify");
  const [registering, setRegistering] = useState(() => location.hash.startsWith("#cadastro"));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const submitEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    if (registering && (!name.trim() || !terms || !privacy)) {
      setMessage("Informe seu nome e aceite os termos e a política de privacidade.");
      return;
    }
    setBusy(true); setMessage("");
    try {
      await requestEmailCode(email, registering ? name : undefined, registering || surface === "client");
      setStage("code");
      setMessage("Código enviado. Ele vale por 10 minutos.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar o código.");
    } finally { setBusy(false); }
  };

  const submitCode = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const result = await verifyEmailCode(email, code);
      if (registering && result.user) {
        const supabase = requireSupabase();
        await supabase.from("profiles").update({ full_name: name.trim() }).eq("id", result.user.id);
        await supabase.from("consent_events").insert([
          { profile_id: result.user.id, consent_type: "club_terms", granted: true, document_version: "1.0", source: "web" },
          { profile_id: result.user.id, consent_type: "privacy", granted: true, document_version: "1.0", source: "web" },
          { profile_id: result.user.id, consent_type: "marketing", granted: marketing, document_version: "1.0", source: "web" },
        ]);
      }
      location.hash = surface === "operation" ? "operacao" : "minha-conta";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Código inválido ou expirado.");
    } finally { setBusy(false); }
  };

  return <main className={`access-page ${surface}`}>
    <header><Brand label={surface === "operation" ? "Adoce Operação" : "Clube Adoce"}/><a href={surface === "operation" ? "/#entrar" : "/#operacao"}>{surface === "operation" ? "Sou cliente" : "Área da equipe"}</a></header>
    <section className="access-auth-shell">
      <div className="access-auth-copy">
        <span>{surface === "operation" ? "Operação segura" : "Seu clube, do seu jeito"}</span>
        <h1>{surface === "operation" ? "Cuidar de cada cliente ficou mais simples." : "Cada fatia aproxima você da próxima conquista."}</h1>
        <p>{surface === "operation" ? "Acesse para localizar clientes, registrar compras e resgatar prêmios com histórico completo." : "Entre com um código enviado por e-mail. Sem senha para esquecer e com seus prêmios sempre à mão."}</p>
        <div className="access-promise"><Heart/><strong>1 fatia = 1 carimbo</strong><small>Tradicional ou premium</small></div>
      </div>
      <div className="access-auth-card">
        <img src="/site/logo.webp" alt=""/>
        <h2>{stage === "code" ? "Confira seu e-mail" : registering ? "Criar meu Clube Adoce" : "Entrar com segurança"}</h2>
        <p>{stage === "code" ? `Digite o código de 6 números enviado para ${email}.` : "Você receberá um código de acesso. Não usamos senha."}</p>
        {stage === "identify" ? <form onSubmit={submitEmail}>
          {registering && <label>Como podemos chamar você?<input value={name} onChange={e=>setName(e.target.value)} autoComplete="name" placeholder="Seu nome completo"/></label>}
          <label>Seu e-mail<div className="input-icon"><Mail/><input value={email} onChange={e=>setEmail(e.target.value)} type="email" autoComplete="email" placeholder="voce@exemplo.com" required/></div></label>
          {registering && <div className="access-consents">
            <label><input type="checkbox" checked={terms} onChange={e=>setTerms(e.target.checked)}/><span>Aceito os termos do Clube Adoce.</span></label>
            <label><input type="checkbox" checked={privacy} onChange={e=>setPrivacy(e.target.checked)}/><span>Li e aceito a política de privacidade.</span></label>
            <label><input type="checkbox" checked={marketing} onChange={e=>setMarketing(e.target.checked)}/><span>Quero receber sabores e novidades. <em>Opcional</em></span></label>
          </div>}
          <button className="access-primary" disabled={busy}>{busy ? "Enviando..." : "Receber código"}<ArrowRight/></button>
        </form> : <form onSubmit={submitCode}>
          <label>Código de acesso<input className="access-code" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g, "").slice(0,6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" autoFocus/></label>
          <button className="access-primary" disabled={busy || code.length !== 6}>{busy ? "Confirmando..." : "Entrar no Clube"}<ArrowRight/></button>
          <button className="access-link" type="button" onClick={()=>{setStage("identify");setCode("");setMessage("")}}>Usar outro e-mail</button>
        </form>}
        {message && <div className="access-message" role="status">{message}</div>}
        {surface === "client" && stage === "identify" && <button className="access-switch" type="button" onClick={()=>{setRegistering(!registering);setMessage("")}}>{registering ? "Já faço parte — quero entrar" : "Ainda não tenho conta — quero me cadastrar"}</button>}
        <small className="access-privacy"><ShieldCheck/> Seus dados são protegidos e usados conforme suas escolhas.</small>
      </div>
    </section>
  </main>;
}

function CustomerHome({ session }: { session: Session }) {
  const [snapshot, setSnapshot] = useState<ClubSnapshot | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { void (async()=>{
    const supabase = requireSupabase();
    const [{ data: profile }, { data: memberships }, { data: referral }] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", session.user.id).single(),
      supabase.from("account_memberships").select("account_id,is_primary").eq("profile_id", session.user.id).eq("active", true),
      supabase.from("referral_codes").select("code").eq("profile_id", session.user.id).maybeSingle(),
    ]);
    const accountId = memberships?.find(m=>m.is_primary)?.account_id || memberships?.[0]?.account_id;
    if (!accountId) { setError("Sua conta está sendo preparada. Atualize em alguns instantes."); return; }
    const [{ data: tracks }, { data: rewards }] = await Promise.all([
      supabase.from("loyalty_tracks").select("id,kind,current_progress,completed_cards").eq("account_id", accountId),
      supabase.from("rewards").select("id,status,track_id").eq("status", "available"),
    ]);
    const main = tracks?.find(t=>t.kind === "main"); const ref = tracks?.find(t=>t.kind === "referral");
    setSnapshot({name:profile?.full_name || "Cliente Adoce",progress:main?.current_progress||0,completed:main?.completed_cards||0,rewards:rewards?.filter(r=>r.track_id===main?.id).length||0,referralProgress:ref?.current_progress||0,referralRewards:rewards?.filter(r=>r.track_id===ref?.id).length||0,referralCode:referral?.code||"—"});
  })().catch(e=>setError(e instanceof Error?e.message:"Não foi possível abrir sua conta.")); }, [session.user.id]);
  if (!snapshot) return <main className="access-loading"><Brand label="Clube Adoce"/><p>{error || "Preparando seu Clube Adoce..."}</p></main>;
  const stamps = Array.from({length:14},(_,i)=>i<snapshot.progress);
  return <main className="club-home"><header><Brand label="Clube Adoce"/><button onClick={()=>void signOut()}><LogOut/> Sair</button></header><section className="club-welcome"><div><span>Olá, {snapshot.name.split(" ")[0]}</span><h1>Seu carinho já está virando conquista.</h1><p>Acompanhe seus carimbos, prêmios e indicações em um só lugar.</p></div><div className="club-mini-stat"><Gift/><strong>{snapshot.rewards}</strong><span>prêmio{snapshot.rewards===1?"":"s"} disponível{snapshot.rewards===1?"":"is"}</span></div></section><section className="club-grid"><article className="club-card-main"><div className="club-card-head"><div><small>Cartão principal</small><h2>{snapshot.progress} de 14 carimbos</h2></div><img src="/site/logo.webp" alt=""/></div><div className="club-stamps">{stamps.map((filled,i)=><span className={filled?"filled":""} key={i}><Heart/></span>)}</div><p>{snapshot.progress===13?"Falta só uma fatia.":snapshot.progress===0?"Sua próxima fatia começa esta história.":`Faltam ${14-snapshot.progress} carimbos para uma nova recompensa.`}</p><div className="club-card-foot"><span><History/> {snapshot.completed} cartões preenchidos</span><span><Gift/> {snapshot.rewards} disponíveis</span></div></article><aside className="club-side"><article><Sparkles/><small>Espalhe Doçura</small><h3>{snapshot.referralProgress} de 14 indicações</h3><p>Seu código pessoal</p><strong className="referral-code">{snapshot.referralCode}</strong><button onClick={()=>void navigator.clipboard.writeText(snapshot.referralCode)}>Copiar código</button></article><article><Smartphone/><h3>Levar para a carteira</h3><p>Apple Wallet e Google Wallet serão sugeridos assim que os passes estiverem liberados.</p><span>Próxima etapa</span></article></aside></section><nav className="club-bottom"><a className="active"><Heart/> Meu cartão</a><a href="/#adoce-hoje"><Sparkles/> Adoce Hoje</a><a><Users/> Compartilhar</a><a><UserRound/> Perfil</a></nav></main>;
}

function OperationHome({ session }: { session: Session }) {
  const [authorized, setAuthorized] = useState<boolean|null>(null); const [role,setRole]=useState("");
  const [query,setQuery]=useState(""); const [results,setResults]=useState<CustomerSnapshot[]>([]); const [selected,setSelected]=useState<CustomerSnapshot|null>(null); const [qty,setQty]=useState(1); const [message,setMessage]=useState(""); const [busy,setBusy]=useState(false);
  const search = useCallback(async(term=query)=>{setBusy(true);const {data,error}=await requireSupabase().rpc("staff_search_customers",{search_text:term});setBusy(false);if(error){setMessage(error.message);return;}setResults((data||[]) as CustomerSnapshot[]);},[query]);
  useEffect(()=>{void (async()=>{const {data}=await requireSupabase().from("staff_members").select("role,active").eq("user_id",session.user.id).maybeSingle();setAuthorized(Boolean(data?.active));setRole(data?.role||"");if(data?.active)await search("");})();},[session.user.id,search]);
  const refreshSelected=async()=>{await search(query);const {data}=await requireSupabase().rpc("staff_search_customers",{search_text:selected?.email||selected?.phone_e164||selected?.full_name||""});if(data?.[0])setSelected(data[0] as CustomerSnapshot);};
  const purchase=async()=>{if(!selected)return;setBusy(true);setMessage("");const {error}=await requireSupabase().rpc("staff_record_purchase",{account_id:selected.account_id,participant_profile_id:selected.profile_id,quantity:qty,idempotency_key:crypto.randomUUID(),referral_code:null});setBusy(false);if(error)setMessage(error.message);else{setMessage(`${qty} carimbo(s) registrado(s) com sucesso.`);setQty(1);await refreshSelected();}};
  const redeem=async()=>{if(!selected?.available_reward_id)return;setBusy(true);const {error}=await requireSupabase().rpc("staff_redeem_reward",{reward_id:selected.available_reward_id,premium_upgrade:false,price_difference:0,idempotency_key:crypto.randomUUID()});setBusy(false);if(error)setMessage(error.message);else{setMessage("Prêmio resgatado. O novo cartão continua acumulando normalmente.");await refreshSelected();}};
  if(authorized===null)return <main className="access-loading"><Brand label="Adoce Operação"/><p>Validando seu acesso...</p></main>;
  if(!authorized)return <main className="access-loading"><Brand label="Adoce Operação"/><ShieldCheck/><h1>Acesso reservado à equipe</h1><p>Este e-mail não possui uma função ativa na operação.</p><button onClick={()=>void signOut()}>Sair</button></main>;
  return <main className="operation-home"><header><Brand label="Adoce Operação"/><div><span>{role === "owner" ? "Proprietário" : role === "manager" ? "Gerente" : "Atendimento"}</span><button onClick={()=>void signOut()}><LogOut/> Sair</button></div></header><div className="operation-shell"><aside><a className="active"><Search/> Atender cliente</a><a><History/> Movimentações</a><a><Users/> Clientes</a><a><ShieldCheck/> Equipe</a></aside><section className="operation-work"><div className="operation-title"><div><span>Atendimento</span><h1>Localizar cliente</h1><p>Busque por nome, telefone ou e-mail.</p></div><div className="operation-role"><Check/> Acesso verificado</div></div><form className="operation-search" onSubmit={e=>{e.preventDefault();void search()}}><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Digite para buscar"/><button disabled={busy}>Buscar</button></form>{!selected?<div className="operation-results">{results.map(customer=><button key={customer.profile_id} onClick={()=>setSelected(customer)}><span className="avatar">{customer.full_name[0]}</span><span><strong>{customer.full_name}</strong><small>{customer.phone_e164||customer.email||"Contato não informado"}</small></span><span><strong>{customer.current_progress}/14</strong><small>{customer.available_rewards} prêmio(s)</small></span><ArrowRight/></button>)}</div>:<div className="operation-customer"><button className="back" onClick={()=>setSelected(null)}>← Voltar à busca</button><div className="customer-top"><span className="avatar">{selected.full_name[0]}</span><div><small>Cliente</small><h2>{selected.full_name}</h2><p>{selected.phone_e164||selected.email}</p></div><div className="customer-progress"><strong>{selected.current_progress}</strong><span>de 14</span></div></div><div className="operation-actions"><article><Plus/><h3>Registrar compra</h3><p>Cada fatia comprada vale um carimbo.</p><div className="stepper"><button onClick={()=>setQty(Math.max(1,qty-1))}>−</button><strong>{qty}</strong><button onClick={()=>setQty(qty+1)}>+</button></div><button className="access-primary" onClick={()=>void purchase()} disabled={busy}>Confirmar {qty} carimbo(s)</button></article><article><Gift/><h3>Resgatar prêmio</h3><p>Fatia tradicional ou premium com pagamento da diferença.</p><strong className="reward-total">{selected.available_rewards} disponível(is)</strong><button className="access-secondary" onClick={()=>void redeem()} disabled={busy||!selected.available_reward_id}>Confirmar fatia tradicional</button></article></div></div>}{message&&<div className="operation-toast"><Check/>{message}</div>}</section></div></main>;
}

export default function AccessApp({ surface }: { surface: Surface }) {
  const [session,setSession]=useState<Session|null|undefined>(undefined);
  useEffect(()=>{const supabase=requireSupabase();void supabase.auth.getSession().then(({data})=>setSession(data.session));const {data}=supabase.auth.onAuthStateChange((_event,next)=>setSession(next));return()=>data.subscription.unsubscribe();},[]);
  const title=useMemo(()=>surface==="operation"?"Adoce Operação":"Clube Adoce",[surface]);
  useEffect(()=>{
    document.title=title;
    const manifest=document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if(manifest)manifest.href=surface==="operation"?"/manifest-operacao.webmanifest":"/manifest-clube.webmanifest";
  },[surface,title]);
  if(session===undefined)return <main className="access-loading"><Brand label={title}/><p>Abrindo com segurança...</p></main>;
  if(!session)return <AuthScreen surface={surface}/>;
  return surface === "operation" ? <OperationHome session={session}/> : <CustomerHome session={session}/>;
}
