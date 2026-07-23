import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { ArrowLeft, Camera, Check, ChevronRight, Gift, Heart, History, LayoutDashboard, LogOut, Plus, Search, Settings, ShieldCheck, Smartphone, UserPlus, Users } from "lucide-react";
import { Customer, cycleProgress, earn, formatPhone, maskPhone, redeem, remainingFor, rewardsFor } from "./domain";
import { loadCustomers, saveCustomers } from "./store";
import MarketingLanding from "./MarketingLanding";
import { installPublicAnalytics } from "./analytics";

const CommercialCatalog = lazy(() => import("./CommercialCatalog"));
const ClubExperience = lazy(() => import("./ClubExperience"));
const GroupOrderPage = lazy(() => import("./GroupOrderPage"));
const LegalPage = lazy(() => import("./LegalPage"));
const OrderPolicyPage = lazy(() => import("./OrderPolicyPage"));
const FeedbackPage = lazy(() => import("./FeedbackPage"));
const PilotApp = lazy(() => import("./PilotApp"));
const AdoceHoje = lazy(() => import("./AdoceHoje"));
const AccessApp = lazy(() => import("./AccessApp"));
const MemberDemo = lazy(() =>
  import("./AccessApp").then((module) => ({ default: module.MemberDemo })),
);
const OperationDemo = lazy(() =>
  import("./AccessApp").then((module) => ({ default: module.OperationDemo })),
);
const OperationV2Demo = lazy(() => import("./operation-v2/OperationV2Demo"));
const SocialCampaign = lazy(() => import("./SocialCampaign"));
const LaunchCampaign = lazy(() => import("./LaunchCampaign"));
const ProductionRollbackDemo = lazy(() =>
  import("./ProductionRollbackPanel").then((module) => ({ default: module.ProductionRollbackDemo })),
);

const loading = <main className="access-loading"><p>Abrindo a experiência Adoce...</p></main>;

type Page = "join" | "card" | "staff" | "admin";
const moneyless = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

function Brand({ compact=false }: { compact?: boolean }) {
  return <div className="brand"><img src="/site/logo.webp" alt="Adoce Brigaderia"/><div><strong>Clube Adoce</strong>{!compact && <span>Adoce Brigaderia</span>}</div></div>;
}

function Card({ customer, onBack }: { customer: Customer; onBack?:()=>void }) {
  const [qr, setQr] = useState("");
  const rewards = rewardsFor(customer.balance), progress = cycleProgress(customer.balance);
  useEffect(() => { QRCode.toDataURL(`${location.origin}/c/${customer.token}`, { width: 320, margin: 1, color: { dark: "#1A0C08", light: "#FFF7ED" } }).then(setQr); }, [customer.token]);
  const status = rewards ? `${rewards} ${rewards === 1 ? "recompensa disponível" : "recompensas disponíveis"}` : progress === 0 ? "Comece hoje a juntar seus carimbos" : progress === 13 ? "Falta só 1 para sua recompensa" : `Faltam ${remainingFor(customer.balance)} para sua recompensa`;
  return <main className="page card-page">
    <header className="simple-header">{onBack && <button className="icon-button" onClick={onBack} aria-label="Voltar"><ArrowLeft/></button>}<Brand compact/><button className="icon-button" aria-label="Ajuda"><Heart/></button></header>
    <section className="wallet-card" aria-label={`Cartão de ${customer.name}`}>
      <div className="card-photo"><img src="/site/hero-cake.webp" alt="Fatia artesanal de chocolate com morango"/></div>
      <div className="card-title"><img src="/site/logo.webp" alt=""/><div><span>Clube</span><strong>Adoce</strong></div></div>
      <div className="member"><span>Membro</span><strong>{customer.name}</strong></div>
      <div className="balance"><strong>{progress}</strong><span>de 14<br/>carimbos</span></div>
      <div className="stamps">{Array.from({length:14}, (_,i)=><span key={i} className={i < progress ? "filled" : ""}><Heart/></span>)}</div>
      <div className={`card-message ${rewards ? "reward" : ""}`}>{rewards ? <Gift/> : <Heart/>}<strong>{status}</strong></div>
    </section>
    <section className="identity-panel"><div><h2>Seu Clube Adoce está pronto</h2><p>Apresente este código no atendimento. Ele identifica sua conta, mas não movimenta o saldo.</p></div>{qr && <img className="qr" src={qr} alt="QR Code pessoal"/>}<span>{maskPhone(customer.phone)}</span></section>
    <div className="wallet-actions"><button className="wallet-button apple"><Smartphone/> Adicionar à Apple Wallet <small>modo demonstração</small></button><button className="wallet-button google"><Smartphone/> Adicionar ao Google Wallet <small>modo demonstração</small></button></div>
    <details className="how"><summary>Como funciona <ChevronRight/></summary><ol><li>Toda fatia comprada, tradicional ou premium, vale 1 carimbo.</li><li>Complete 14 e ganhe uma fatia tradicional.</li><li>Prefere uma premium? Pague somente a diferença.</li><li>O prêmio fica disponível enquanto o novo cartão continua.</li></ol></details>
  </main>;
}

function Join({ onCreated, goStaff }: { onCreated:(c:Customer)=>void; goStaff:()=>void }) {
  const [name,setName]=useState(""); const [phone,setPhone]=useState(""); const [email,setEmail]=useState(""); const [terms,setTerms]=useState(false); const [privacy,setPrivacy]=useState(false); const [marketing,setMarketing]=useState(false); const [error,setError]=useState("");
  const submit=(e:React.FormEvent)=>{e.preventDefault(); if(!name.trim()||phone.length<10||!terms||!privacy){setError("Preencha nome e telefone e aceite os termos e a política de privacidade.");return;} const existing=loadCustomers().find(c=>c.phone===phone); if(existing){setError("Já existe um cartão para este telefone. Abrimos o cartão existente."); setTimeout(()=>onCreated(existing),900); return;} const c:Customer={id:crypto.randomUUID(),name:name.trim(),phone,email:email||undefined,balance:0,token:`adoce_${crypto.randomUUID().replaceAll("-","")}`,status:"ACTIVE",marketingConsent:marketing,transactions:[]}; const all=[c,...loadCustomers()];saveCustomers(all);onCreated(c)};
  return <main className="join-page"><nav><Brand/><button className="text-button" onClick={goStaff}>Área da equipe <ChevronRight/></button></nav><section className="join-hero"><div className="hero-copy"><h1>Seu carinho agora <em>também</em> vira conquista.</h1><p>Cada fatia comprada vale 1 carimbo. Complete 14 e guarde sua recompensa no celular, para usar quando quiser.</p><div className="mini-benefits"><span><Heart/> 1 fatia = 1 carimbo</span><span><Gift/> Prêmio no seu tempo</span><span><Smartphone/> Cartão digital</span></div></div><div className="hero-photo"><img src="/site/hero-cake.webp" alt="Fatia de chocolate com morango da Adoce"/></div></section><section className="join-form-wrap"><div><h2>Entre para o Clube</h2><p>Leva menos de um minuto.</p></div><form onSubmit={submit}><label>Seu nome<input value={name} onChange={e=>setName(e.target.value)} autoComplete="name" placeholder="Como podemos te chamar?"/></label><label>WhatsApp ou telefone<input value={phone} onChange={e=>setPhone(formatPhone(e.target.value))} inputMode="tel" autoComplete="tel" placeholder="DDD + número"/></label><label>E-mail <span>(opcional)</span><input value={email} onChange={e=>setEmail(e.target.value)} type="email" autoComplete="email" placeholder="voce@exemplo.com"/></label><label className="check"><input type="checkbox" checked={terms} onChange={e=>setTerms(e.target.checked)}/><span>Aceito os termos do programa.</span></label><label className="check"><input type="checkbox" checked={privacy} onChange={e=>setPrivacy(e.target.checked)}/><span>Li e aceito a política de privacidade.</span></label><label className="check optional"><input type="checkbox" checked={marketing} onChange={e=>setMarketing(e.target.checked)}/><span>Quero receber novidades e promoções. (opcional)</span></label>{error&&<div className="form-error" role="alert">{error}</div>}<button className="primary" type="submit">Criar meu Clube Adoce <ChevronRight/></button></form></section><footer><Brand compact/><p>Feito com amor em cada detalhe.</p></footer></main>;
}

function Staff({ customers, update, back }: {customers:Customer[];update:(c:Customer)=>void;back:()=>void}) {
  const [query,setQuery]=useState(""); const [selected,setSelected]=useState<Customer|null>(null); const [qty,setQty]=useState(1); const [toast,setToast]=useState("");
  const filtered=customers.filter(c=>`${c.name} ${c.phone}`.toLowerCase().includes(query.toLowerCase()));
  const commit=(kind:"earn"|"redeem")=>{if(!selected)return; try {const next=kind==="earn"?earn(selected,qty):redeem(selected);update(next);setSelected(next);setToast(kind==="earn"?`${qty} carimbo(s) adicionados.`:"Recompensa resgatada. O cartão atual continua preservado.");setTimeout(()=>setToast(""),3200)}catch{setToast("Saldo insuficiente para o resgate.")}};
  return <main className="staff-page"><header className="staff-header"><Brand compact/><span>Atendimento</span><button className="icon-button" onClick={back} aria-label="Sair"><LogOut/></button></header><div className="staff-shell"><aside><button className="active"><Camera/> Atender cliente</button><button><History/> Movimentações</button><button><Users/> Clientes</button></aside><section className="service"><div className="service-head"><div><h1>Atender cliente</h1><p>Escaneie o QR pessoal ou busque pelo telefone.</p></div><button className="scan-button"><Camera/> Escanear cartão</button></div><label className="search"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar por nome ou telefone"/></label>{query && !selected && <div className="search-results">{filtered.map(c=><button key={c.id} onClick={()=>setSelected(c)}><span><strong>{c.name}</strong><small>{maskPhone(c.phone)}</small></span><span>{c.balance} carimbos <ChevronRight/></span></button>)}</div>}{selected && <div className="customer-workspace"><div className="customer-summary"><div className="avatar">{selected.name[0]}</div><div><span>Cliente</span><h2>{selected.name}</h2><p>{maskPhone(selected.phone)} · Conta ativa</p></div><button className="text-button" onClick={()=>setSelected(null)}>Trocar</button></div><div className="balance-strip"><div><span>Progresso atual</span><strong>{cycleProgress(selected.balance)}</strong><small>de 14 carimbos</small></div><div><span>Recompensas</span><strong>{rewardsFor(selected.balance)}</strong><small>disponíveis</small></div><div><span>Próxima recompensa</span><strong>{remainingFor(selected.balance)}</strong><small>carimbos</small></div></div><div className="operations"><section><h3>Adicionar carimbos</h3><p>Toda fatia paga, tradicional ou premium, vale 1 carimbo.</p><div className="stepper"><button onClick={()=>setQty(Math.max(1,qty-1))}>−</button><strong>{qty}</strong><button onClick={()=>setQty(qty+1)}>+</button></div><button className="primary" onClick={()=>commit("earn")}><Plus/> Confirmar carimbos</button></section><section><h3>Resgatar recompensa</h3><p>O resgate usa 1 prêmio disponível e não altera o cartão atual.</p><div className="reward-count"><Gift/><strong>{rewardsFor(selected.balance)}</strong><span>fatia(s) disponível(is)</span></div><button className="secondary" disabled={selected.balance<14} onClick={()=>commit("redeem")}><Gift/> Confirmar resgate</button></section></div><div className="ledger"><h3>Últimas movimentações</h3>{selected.transactions.length===0?<p>Nenhuma movimentação recente.</p>:selected.transactions.slice(0,5).map(t=><div key={t.id}><span className={t.pointsDelta>0?"positive":"negative"}>{t.pointsDelta>0?"+":""}{t.pointsDelta}</span><span><strong>{t.type}</strong><small>{moneyless.format(new Date(t.createdAt))}</small></span><strong>{t.resultingBalance}</strong></div>)}</div></div>}</section></div>{toast&&<div className="toast"><Check/>{toast}</div>}</main>;
}

function Admin({customers,back}:{customers:Customer[];back:()=>void}) { const total=customers.reduce((s,c)=>s+cycleProgress(c.balance),0); return <main className="admin-page"><aside className="admin-nav"><Brand compact/><nav><button className="active"><LayoutDashboard/> Visão geral</button><button><Users/> Clientes</button><button><History/> Movimentações</button><button><ShieldCheck/> Equipe</button><button><Settings/> Configurações</button></nav><button onClick={back}><LogOut/> Sair</button></aside><section className="admin-main"><header><div><span>Painel administrativo</span><h1>Visão geral</h1></div><div className="admin-user">Rubens <span>OWNER</span></div></header><div className="metrics"><div><span>Clientes ativos</span><strong>{customers.length}</strong><small>contas de demonstração</small></div><div><span>Carimbos nos cartões atuais</span><strong>{total}</strong><small>progresso em andamento</small></div><div><span>Recompensas disponíveis</span><strong>{customers.reduce((s,c)=>s+rewardsFor(c.balance),0)}</strong><small>prêmios liberados</small></div><div><span>Próximos da recompensa</span><strong>{customers.filter(c=>remainingFor(c.balance)<=3).length}</strong><small>até 3 carimbos</small></div></div><section className="admin-table"><div className="table-head"><div><h2>Clientes</h2><p>Contas e saldos do programa</p></div><button className="secondary"><UserPlus/> Novo cliente</button></div><div className="table-row table-label"><span>Cliente</span><span>Telefone</span><span>Progresso</span><span>Recompensas</span><span>Status</span></div>{customers.map(c=><div className="table-row" key={c.id}><span><strong>{c.name}</strong><small>{c.email||"Sem e-mail"}</small></span><span>{maskPhone(c.phone)}</span><span>{cycleProgress(c.balance)}/14</span><span>{rewardsFor(c.balance)}</span><span className="status">Ativa</span></div>)}</section></section></main> }

function LegacyApp(){ const seeded=useMemo(loadCustomers,[]); const [page,setPage]=useState<Page>(()=>location.hash.includes("card-demo")?"card":location.hash.includes("staff")?"staff":location.hash.includes("admin")?"admin":"join"); const [customers,setCustomers]=useState(seeded); const [current,setCurrent]=useState<Customer|null>(()=>location.hash.includes("card-demo")?seeded.find(c=>c.balance===14)||seeded[0]:null); const update=(c:Customer)=>{const next=customers.map(x=>x.id===c.id?c:x);setCustomers(next);saveCustomers(next);setCurrent(c)}; const nav=(p:Page)=>{setPage(p);location.hash=p}; useEffect(()=>{const f=()=>setPage(location.hash.includes("card-demo")?"card":location.hash.includes("staff")?"staff":location.hash.includes("admin")?"admin":"join");addEventListener("hashchange",f);return()=>removeEventListener("hashchange",f)},[]); if(page==="card"&&current)return <Card customer={current} onBack={()=>nav("join")}/>; if(page==="staff")return <Staff customers={customers} update={update} back={()=>nav("join")}/>; if(page==="admin")return <Admin customers={customers} back={()=>nav("join")}/>; return <Join onCreated={c=>{setCurrent(c);nav("card")}} goStaff={()=>nav("staff")}/> }
export default function App(){
  const [, refreshRoute] = useState(0);
  useEffect(() => installPublicAnalytics(), []);
  useEffect(() => {
    const handleHashChange = () => {
      refreshRoute(version => version + 1);
      document.title = location.hash.startsWith("#operacao")
        ? "Adoce Operação"
          : location.hash.startsWith("#adoce-hoje")
            ? "Adoce Hoje · Adoce Brigaderia"
          : location.hash.startsWith("#cadastro")
            ? "Cadastro · Clube Adoce"
          : location.hash.startsWith("#docinhos")
            ? "Docinhos · Adoce Brigaderia"
          : location.hash.startsWith("#encomendas")
            ? "Encomendas · Adoce Brigaderia"
            : location.hash.startsWith("#eventos")
              ? "Festas e eventos · Adoce Brigaderia"
              : location.hash.startsWith("#adoce-na-escola")
                ? "Adoce na Escola · Adoce Brigaderia"
                : location.hash.startsWith("#aluguel-decoracao")
                  ? "Aluguel de decoração · Adoce Brigaderia"
                : location.hash.startsWith("#pede-junto") || location.hash.startsWith("#compra-em-grupo")
                  ? "Pede Junto Adoce · Adoce Brigaderia"
                : location.hash.startsWith("#politica-de-pedidos")
                  ? "Política de pedidos · Adoce Brigaderia"
                : location.hash.startsWith("#clube")
                  ? "Clube Adoce · Adoce Brigaderia"
            : location.hash.startsWith("#privacidade")
              ? "Política de Privacidade · Adoce Brigaderia"
                : location.hash.startsWith("#termos")
                  ? "Termos do Clube Adoce"
                : location.hash.startsWith("#fale-com-a-adoce")
                  ? "Fale com a Adoce"
                : "Adoce Brigaderia | Fatias artesanais e Clube Adoce em Fortaleza";
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);
  const host = location.hostname.toLowerCase();
  if(location.hash.startsWith("#campanha-story"))return <Suspense fallback={loading}><SocialCampaign format="story"/></Suspense>;
  if(location.hash.startsWith("#campanha-feed"))return <Suspense fallback={loading}><SocialCampaign format="feed"/></Suspense>;
  if(location.hash.startsWith("#lancamento-story"))return <Suspense fallback={loading}><LaunchCampaign format="story"/></Suspense>;
  if(location.hash.startsWith("#lancamento-facebook"))return <Suspense fallback={loading}><LaunchCampaign format="facebook"/></Suspense>;
  if(location.hash.startsWith("#lancamento-carrossel-"))return <Suspense fallback={loading}><LaunchCampaign format="carousel" slide={Number(location.hash.split("-").at(-1)) || 1}/></Suspense>;
  if(location.hash.startsWith("#lancamento-feed"))return <Suspense fallback={loading}><LaunchCampaign format="feed"/></Suspense>;
  if(import.meta.env.DEV && location.hash.startsWith("#membro-demo"))return <Suspense fallback={loading}><MemberDemo/></Suspense>;
  if(import.meta.env.DEV && location.hash.startsWith("#operacao-v2"))return <Suspense fallback={loading}><OperationV2Demo/></Suspense>;
  if(import.meta.env.DEV && location.hash.startsWith("#operacao-demo"))return <Suspense fallback={loading}><OperationDemo/></Suspense>;
  if(import.meta.env.DEV && location.hash.startsWith("#restauracao-demo"))return <Suspense fallback={loading}><ProductionRollbackDemo/></Suspense>;
  if (host.startsWith("operacao.") || location.hash.startsWith("#operacao")) return <Suspense fallback={loading}><AccessApp surface="operation"/></Suspense>;
  if (host.startsWith("clube.") || location.hash.startsWith("#entrar") || location.hash.startsWith("#cadastro") || location.hash.startsWith("#minha-conta") || location.hash.startsWith("#acesso-direto")) return <Suspense fallback={loading}><AccessApp surface="client"/></Suspense>;
  if(location.hash.startsWith("#adoce-hoje"))return <Suspense fallback={loading}><AdoceHoje/></Suspense>;
  if(location.hash.startsWith("#encomendas"))return <Suspense fallback={loading}><CommercialCatalog initialSegment="cakes"/></Suspense>;
  if(location.hash.startsWith("#docinhos"))return <Suspense fallback={loading}><CommercialCatalog initialSegment="sweets"/></Suspense>;
  if(location.hash.startsWith("#eventos"))return <Suspense fallback={loading}><CommercialCatalog initialSegment="events"/></Suspense>;
  if(location.hash.startsWith("#adoce-na-escola"))return <Suspense fallback={loading}><CommercialCatalog initialSegment="school"/></Suspense>;
  if(location.hash.startsWith("#aluguel-decoracao"))return <Suspense fallback={loading}><CommercialCatalog initialSegment="rentals"/></Suspense>;
  if(location.hash.startsWith("#pede-junto") || location.hash.startsWith("#compra-em-grupo"))return <Suspense fallback={loading}><GroupOrderPage/></Suspense>;
  if(location.hash.startsWith("#politica-de-pedidos"))return <Suspense fallback={loading}><OrderPolicyPage/></Suspense>;
  if(location.hash.startsWith("#fale-com-a-adoce"))return <Suspense fallback={loading}><FeedbackPage/></Suspense>;
  if(location.hash.startsWith("#clube"))return <Suspense fallback={loading}><ClubExperience/></Suspense>;
  if(location.hash.startsWith("#termos"))return <Suspense fallback={loading}><LegalPage kind="terms"/></Suspense>;
  if(location.hash.startsWith("#privacidade"))return <Suspense fallback={loading}><LegalPage kind="privacy"/></Suspense>;
  const pilotToken=location.hash.match(/^#cartao\/([a-f0-9-]+)$/i)?.[1];
  if(pilotToken)return <Suspense fallback={loading}><PilotApp token={pilotToken}/></Suspense>;
  if(import.meta.env.DEV && location.hash.startsWith("#festival"))return <Suspense fallback={loading}><PilotApp/></Suspense>;
  if(import.meta.env.DEV && location.hash.startsWith("#prototipo"))return <LegacyApp/>;
  return <MarketingLanding/>
}
