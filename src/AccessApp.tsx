import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { ArrowRight, CakeSlice, Check, CircleHelp, Gift, Heart, History, LogOut, Mail, Plus, Search, ShieldCheck, Smartphone, Sparkles, UserRound, Users } from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import { requestEmailCode, signOut, verifyEmailCode } from "./services/auth";
import { matchesCustomerSearch } from "./customer-search";
import { currentConsent, isCustomerOnboardingComplete, type ConsentEvent } from "./customer-onboarding";
import "./access-app.css";
import "./referral.css";

type Surface = "client" | "operation";
type AuthStage = "identify" | "code";
type ClubView = "card" | "share" | "help" | "profile";
type OperationView = "attend" | "movements" | "customers" | "team";

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

type CustomerSearchResult = Pick<CustomerSnapshot, "profile_id" | "full_name" | "phone_e164" | "email">;

type ClubSnapshot = {
  name: string;
  progress: number;
  completed: number;
  rewards: number;
  referralProgress: number;
  referralRewards: number;
  referralCode: string;
  pendingReferrals: number;
  acceptedInvites: ReferralInvite[];
};

type ReferralInvite = {
  first_name: string;
  status: "pending" | "confirmed" | "reversed" | "rejected";
  created_at: string;
};

type ReferralOverview = {
  pending_count: number;
  confirmed_count: number;
  accepted: ReferralInvite[];
};

const referralStorageKey = "adoce-referral-invite";
const referralCodeFromUrl = () => new URLSearchParams(location.search).get("indicacao")?.trim().toUpperCase() || "";

function rememberReferralInvite() {
  const code = referralCodeFromUrl();
  if (code) sessionStorage.setItem(referralStorageKey, code);
  return code || sessionStorage.getItem(referralStorageKey) || "";
}

async function acceptRememberedReferral() {
  const code = rememberReferralInvite();
  if (!code) return false;
  const { error } = await requireSupabase().rpc("accept_referral_invite", { invite_code: code });
  if (error) throw error;
  sessionStorage.removeItem(referralStorageKey);
  return true;
}

type Movement = {
  id: string;
  reason: string;
  stamps_delta: number;
  created_at: string;
  subject_profile_id: string | null;
};

type StaffMember = {
  user_id: string;
  role: string;
  active: boolean;
  display_name?: string;
};

function Brand({ label }: { label: string }) {
  return <a className="access-brand" href="/"><img src="/site/logo.webp" alt="Adoce Brigaderia"/><span><strong>{label}</strong><small>Adoce Brigaderia</small></span></a>;
}

function AuthScreen({ surface }: { surface: Surface }) {
  const [stage, setStage] = useState<AuthStage>("identify");
  const [registering, setRegistering] = useState(() => location.hash.startsWith("#cadastro") || Boolean(rememberReferralInvite()));
  const invited = surface === "client" && Boolean(rememberReferralInvite());
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
        const cleanName = name.trim();
        const { error: metadataError } = await supabase.auth.updateUser({ data: { full_name: cleanName } });
        if (metadataError) throw metadataError;
        const { error: profileError } = await supabase.from("profiles").update({ full_name: cleanName }).eq("id", result.user.id);
        if (profileError) throw profileError;
        const { error: consentError } = await supabase.from("consent_events").insert([
          { profile_id: result.user.id, consent_type: "club_terms", granted: true, document_version: "1.0", source: "web" },
          { profile_id: result.user.id, consent_type: "privacy", granted: true, document_version: "1.0", source: "web" },
          { profile_id: result.user.id, consent_type: "marketing", granted: marketing, document_version: "1.0", source: "web" },
        ]);
        if (consentError) throw consentError;
        await acceptRememberedReferral();
        window.dispatchEvent(new Event("adoce-profile-ready"));
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
        <span>{surface === "operation" ? "Operação segura" : invited ? "Você recebeu um convite" : "Seu clube, do seu jeito"}</span>
        <h1>{surface === "operation" ? "Cuidar de cada cliente ficou mais simples." : invited ? "Você já começa mais perto da sua fatia premiada." : "Cada fatia aproxima você da próxima conquista."}</h1>
        <p>{surface === "operation" ? "Acesse para localizar clientes, registrar compras e resgatar prêmios com histórico completo." : invited ? "Aceite o convite, conclua seu cadastro e ganhe 1 carimbo extra quando fizer sua primeira compra." : "Entre com um código enviado por e-mail. Sem senha para esquecer e com seus prêmios sempre à mão."}</p>
        <div className="access-promise"><Heart/><strong>1 fatia = 1 carimbo</strong><small>Tradicional ou premium</small></div>
      </div>
      <div className="access-auth-card">
        <img src="/site/logo.webp" alt=""/>
        <h2>{stage === "code" ? "Confira seu e-mail" : invited ? "Aceitar convite e reservar meu carimbo" : registering ? "Criar meu Clube Adoce" : "Entrar com segurança"}</h2>
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
  const [onboardingRequired, setOnboardingRequired] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<ClubView>("card");
  const [profileName, setProfileName] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [marketingAccepted, setMarketingAccepted] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const loadSnapshot = useCallback(async()=>{
    const supabase = requireSupabase();
    setError("");
    const [{ data: profile, error: profileError }, { data: consentRows, error: consentError }] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", session.user.id).single(),
      supabase.from("consent_events").select("consent_type,granted,created_at").eq("profile_id", session.user.id).order("created_at", { ascending: false }),
    ]);
    if (profileError || consentError) throw profileError || consentError;

    const consents = (consentRows || []) as ConsentEvent[];
    const metadataName = typeof session.user.user_metadata?.full_name === "string" ? session.user.user_metadata.full_name.trim() : "";
    const databaseName = profile?.full_name?.trim() || "";
    const nameForForm = databaseName && databaseName !== "Cliente Adoce" ? databaseName : metadataName;
    setProfileName(nameForForm);
    setTermsAccepted(currentConsent(consents, "club_terms"));
    setPrivacyAccepted(currentConsent(consents, "privacy"));
    setMarketingAccepted(currentConsent(consents, "marketing"));

    if (!isCustomerOnboardingComplete(databaseName, consents)) {
      setSnapshot(null);
      setOnboardingRequired(true);
      return;
    }

    setOnboardingRequired(false);
    if (rememberReferralInvite()) {
      try {
        await acceptRememberedReferral();
        setMessage("Convite aceito. Seu carimbo extra está reservado para a primeira compra.");
      } catch (inviteError) {
        setMessage(inviteError instanceof Error ? inviteError.message : "Não foi possível vincular o convite.");
      }
    }
    const [{ data: memberships, error: membershipError }, { data: referral, error: referralError }, { data: overview, error: overviewError }] = await Promise.all([
      supabase.from("account_memberships").select("account_id,is_primary").eq("profile_id", session.user.id).eq("active", true),
      supabase.from("referral_codes").select("code").eq("profile_id", session.user.id).maybeSingle(),
      supabase.rpc("customer_referral_overview"),
    ]);
    if (membershipError || referralError || overviewError) throw membershipError || referralError || overviewError;
    const accountId = memberships?.find(m=>m.is_primary)?.account_id || memberships?.[0]?.account_id;
    if (!accountId) { setError("Sua conta está sendo preparada. Atualize em alguns instantes."); return; }
    const [{ data: tracks, error: tracksError }, { data: rewards, error: rewardsError }] = await Promise.all([
      supabase.from("loyalty_tracks").select("id,kind,current_progress,completed_cards").eq("account_id", accountId),
      supabase.from("rewards").select("id,status,track_id").eq("status", "available"),
    ]);
    if (tracksError || rewardsError) throw tracksError || rewardsError;
    const main = tracks?.find(t=>t.kind === "main"); const ref = tracks?.find(t=>t.kind === "referral");
    const resolvedName = databaseName;
    setProfileName(resolvedName);
    const referralOverview = (overview || {pending_count:0,confirmed_count:0,accepted:[]}) as ReferralOverview;
    setSnapshot({name:resolvedName,progress:main?.current_progress||0,completed:main?.completed_cards||0,rewards:rewards?.filter(r=>r.track_id===main?.id).length||0,referralProgress:ref?.current_progress||0,referralRewards:rewards?.filter(r=>r.track_id===ref?.id).length||0,referralCode:referral?.code||"—",pendingReferrals:Number(referralOverview.pending_count||0),acceptedInvites:referralOverview.accepted||[]});
  }, [session.user.id, session.user.user_metadata]);
  useEffect(() => { void loadSnapshot().catch(e=>setError(e instanceof Error?e.message:"Não foi possível abrir sua conta.")); }, [loadSnapshot]);
  useEffect(() => {
    const reloadCompletedProfile = () => {
      void loadSnapshot().catch(e=>setError(e instanceof Error?e.message:"Não foi possível abrir sua conta."));
    };
    window.addEventListener("adoce-profile-ready", reloadCompletedProfile);
    return () => window.removeEventListener("adoce-profile-ready", reloadCompletedProfile);
  }, [loadSnapshot]);
  const completeOnboarding = async(event: React.FormEvent) => {
    event.preventDefault();
    const cleanName = profileName.trim();
    if (cleanName.length < 2 || cleanName.toLocaleLowerCase("pt-BR") === "cliente adoce") {
      setMessage("Informe seu nome para concluir o cadastro.");
      return;
    }
    if (!termsAccepted || !privacyAccepted) {
      setMessage("Aceite os termos do Clube e a política de privacidade para continuar.");
      return;
    }

    setBusy(true); setMessage("");
    const supabase = requireSupabase();
    const { error: profileError } = await supabase.from("profiles").update({full_name:cleanName}).eq("id",session.user.id);
    if (profileError) { setBusy(false); setMessage(profileError.message); return; }
    const { error: metadataError } = await supabase.auth.updateUser({data:{full_name:cleanName}});
    if (metadataError) { setBusy(false); setMessage(metadataError.message); return; }
    const { error: consentError } = await supabase.from("consent_events").insert([
      { profile_id: session.user.id, consent_type: "club_terms", granted: true, document_version: "1.0", source: "web_onboarding" },
      { profile_id: session.user.id, consent_type: "privacy", granted: true, document_version: "1.0", source: "web_onboarding" },
      { profile_id: session.user.id, consent_type: "marketing", granted: marketingAccepted, document_version: "1.0", source: "web_onboarding" },
    ]);
    if (consentError) { setBusy(false); setMessage(consentError.message); return; }

    setOnboardingRequired(null);
    try {
      await loadSnapshot();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível abrir sua conta.");
    } finally {
      setBusy(false);
    }
  };
  const saveProfile = async(event: React.FormEvent) => {
    event.preventDefault(); const cleanName=profileName.trim(); if(!cleanName)return;
    setBusy(true); setMessage(""); const supabase=requireSupabase();
    const [{error:profileError},{error:metadataError}]=await Promise.all([
      supabase.from("profiles").update({full_name:cleanName}).eq("id",session.user.id),
      supabase.auth.updateUser({data:{full_name:cleanName}}),
    ]);
    setBusy(false);
    if(profileError||metadataError){setMessage(profileError?.message||metadataError?.message||"Não foi possível salvar seu nome.");return;}
    setMessage("Perfil atualizado com sucesso."); await loadSnapshot();
  };
  const shareClub=async()=>{
    const code=snapshot?.referralCode||"";
    const url=`${location.origin}/?indicacao=${encodeURIComponent(code)}#cadastro`;
    const text="Oi! Vem para o Clube Adoce comigo 🍰💗 Cadastre-se pelo meu link e, na sua primeira compra, você ganha 1 carimbo extra. Eu também ganho quando você experimentar!";
    if(navigator.share)await navigator.share({title:"Convite para o Clube Adoce",text,url});
    else{await navigator.clipboard.writeText(`${text}\n${url}`);setMessage("Convite com seu link pessoal copiado. Agora é só enviar.");}
  };
  if (onboardingRequired) return <main className="club-onboarding"><header><Brand label="Clube Adoce"/><button onClick={()=>void signOut()}><LogOut/> Sair</button></header><section className="club-onboarding-shell"><div className="club-onboarding-copy"><img src="/site/logo.webp" alt="Adoce Brigaderia"/><span>Último passo</span><h1>Vamos completar seu cadastro.</h1><p>Seu e-mail já foi confirmado. Agora precisamos saber seu nome e registrar suas escolhas antes de liberar o cartão fidelidade.</p><div><ShieldCheck/><strong>Seus dados ficam protegidos</strong><small>Você poderá revisar suas informações no perfil.</small></div></div><form className="club-onboarding-form" onSubmit={completeOnboarding}><h2>Como podemos chamar você?</h2><p>Os campos marcados são necessários para participar do Clube Adoce.</p><label>Nome completo *<input value={profileName} onChange={event=>setProfileName(event.target.value)} autoComplete="name" placeholder="Seu nome completo" required/></label><label>E-mail confirmado<input value={session.user.email||""} readOnly/></label><div className="access-consents"><label><input type="checkbox" checked={termsAccepted} onChange={event=>setTermsAccepted(event.target.checked)}/><span>Aceito os termos do Clube Adoce. *</span></label><label><input type="checkbox" checked={privacyAccepted} onChange={event=>setPrivacyAccepted(event.target.checked)}/><span>Li e aceito a política de privacidade. *</span></label><label><input type="checkbox" checked={marketingAccepted} onChange={event=>setMarketingAccepted(event.target.checked)}/><span>Quero receber sabores, promoções e novidades. <em>Opcional</em></span></label></div><button className="access-primary" disabled={busy}>{busy?"Concluindo...":"Concluir e abrir meu cartão"}<ArrowRight/></button>{message&&<div className="access-message" role="status">{message}</div>}<small><ShieldCheck/> Você só verá o cartão depois que esta etapa for concluída.</small></form></section></main>;
  if (!snapshot) return <main className="access-loading"><Brand label="Clube Adoce"/><p>{error || (onboardingRequired === null ? "Verificando seu cadastro..." : "Preparando seu Clube Adoce...")}</p></main>;
  const stamps = Array.from({length:14},(_,i)=>i<snapshot.progress);
  return <main className="club-home"><header><Brand label="Clube Adoce"/><div className="club-header-actions"><a href="/#adoce-hoje"><CakeSlice/> Adoce Hoje</a><button onClick={()=>setView("help")}><CircleHelp/> Como funciona</button><button onClick={()=>void signOut()}><LogOut/> Sair</button></div></header>
    {view==="card"&&<><section className="club-welcome"><div><span>Olá, {snapshot.name.split(" ")[0]}</span><h1>Seu carinho já está virando conquista.</h1><p>Acompanhe seus carimbos, prêmios e indicações em um só lugar.</p><div className="club-quick-links"><a href="/#adoce-hoje"><CakeSlice/> Ver sabores de hoje</a><button onClick={()=>setView("help")}><CircleHelp/> Aprender a usar o Clube</button></div></div><div className="club-mini-stat"><Gift/><strong>{snapshot.rewards}</strong><span>prêmio{snapshot.rewards===1?"":"s"} {snapshot.rewards===1?"disponível":"disponíveis"}</span></div></section><section className="club-grid"><article className="club-card-main"><div className="club-card-head"><div><small>Cartão principal</small><h2>{snapshot.progress} de 14 carimbos</h2></div><img src="/site/logo.webp" alt=""/></div><div className="club-stamps">{stamps.map((filled,i)=><span className={filled?"filled":""} key={i}><Heart/></span>)}</div><p>{snapshot.progress===13?"Falta só uma fatia.":snapshot.progress===0?"Sua próxima fatia começa esta história.":`Faltam ${14-snapshot.progress} carimbos para uma nova recompensa.`}</p><div className="club-card-foot"><span><History/> {snapshot.completed} cartões preenchidos</span><span><Gift/> {snapshot.rewards} disponíveis</span></div></article><aside className="club-side"><article><Sparkles/><small>Espalhe Doçura</small><h3>{snapshot.referralProgress} de 14 indicações</h3>{snapshot.pendingReferrals>0&&<p className="referral-pending"><Heart/> {snapshot.pendingReferrals} convite{snapshot.pendingReferrals===1?" aceito":"s aceitos"} aguardando primeira compra</p>}<p>Seu link pessoal já leva o convite junto.</p><button onClick={()=>setView("share")}>Convidar alguém</button></article><article><Smartphone/><h3>Levar para a carteira</h3><p>Apple Wallet e Google Wallet serão sugeridos assim que os passes estiverem liberados.</p><span>Próxima etapa</span></article></aside></section></>}
    {view==="share"&&<section className="club-panel club-referral-guide"><Sparkles/><small>Espalhe Doçura</small><h1>Convide com seu link. O bônus fica reservado automaticamente.</h1><p>A pessoa abre seu convite, conclui o cadastro e você acompanha aqui enquanto ela ainda não fez a primeira compra.</p><div className="referral-track">{Array.from({length:14},(_,index)=><span key={index} className={index<snapshot.referralProgress?"confirmed":index<snapshot.referralProgress+snapshot.pendingReferrals?"pending":""}><Heart/></span>)}</div>{snapshot.acceptedInvites.length>0&&<div className="referral-accepted-list">{snapshot.acceptedInvites.map((invite,index)=><div key={`${invite.first_name}-${invite.created_at}-${index}`}><span>{invite.first_name[0]}</span><p><strong>{invite.first_name} aceitou seu convite</strong><small>{invite.status==="confirmed"?"Primeira compra confirmada":"Aguardando a primeira compra"}</small></p></div>)}</div>}<ol><li><b>1</b><span><strong>Envie seu link pessoal</strong><small>O WhatsApp já abre com uma mensagem curta e amigável.</small></span></li><li><b>2</b><span><strong>A pessoa aceita e se cadastra</strong><small>O vínculo é feito automaticamente, sem digitar código na venda.</small></span></li><li><b>3</b><span><strong>Acompanhe quem aceitou</strong><small>O convite fica reservado enquanto aguarda a primeira compra.</small></span></li><li><b>4</b><span><strong>Na primeira compra, os dois ganham</strong><small>O sistema confirma automaticamente os dois carimbos.</small></span></li></ol><button className="access-primary" onClick={()=>void shareClub()}><Users/> Compartilhar meu link no WhatsApp</button></section>}
    {view==="help"&&<section className="club-panel club-help"><CircleHelp/><small>Ajuda do Clube</small><h1>É simples participar.</h1><div className="club-help-list"><article><Heart/><span><strong>Como ganho carimbos?</strong><small>Cada fatia comprada, tradicional ou premium, vale 1 carimbo.</small></span></article><article><Gift/><span><strong>O que acontece ao completar 14?</strong><small>Você ganha uma fatia tradicional ou escolhe uma premium pagando somente a diferença. O prêmio fica guardado até você decidir retirar.</small></span></article><article><Sparkles/><span><strong>Como funciona minha indicação?</strong><small>Compartilhe seu link pessoal. O cadastro fica vinculado automaticamente e, na primeira compra, os dois ganham 1 carimbo.</small><button onClick={()=>setView("share")}>Ver e compartilhar meu link</button></span></article><article><CakeSlice/><span><strong>Onde vejo os sabores disponíveis?</strong><small>Abra o Adoce Hoje para consultar sabores, atendimento e informações atualizadas.</small><a href="/#adoce-hoje">Abrir Adoce Hoje</a></span></article></div></section>}
    {view==="profile"&&<section className="club-panel"><UserRound/><small>Meu perfil</small><h1>Seus dados no Clube.</h1><form onSubmit={saveProfile}><label>Nome completo<input value={profileName} onChange={event=>setProfileName(event.target.value)} autoComplete="name"/></label><label>E-mail<input value={session.user.email||""} readOnly/></label><button className="access-primary" disabled={busy}>{busy?"Salvando...":"Salvar meu nome"}</button></form></section>}
    {message&&<div className="operation-toast"><Check/>{message}</div>}
    <nav className="club-bottom"><button className={view==="card"?"active":""} onClick={()=>setView("card")}><Heart/> Meu cartão</button><a href="/#adoce-hoje"><CakeSlice/> Adoce Hoje</a><button className={view==="share"?"active":""} onClick={()=>setView("share")}><Users/> Indicar</button><button className={view==="profile"?"active":""} onClick={()=>setView("profile")}><UserRound/> Perfil</button></nav></main>;
}

function OperationHome({ session }: { session: Session }) {
  const [authorized, setAuthorized] = useState<boolean|null>(null); const [role,setRole]=useState("");
  const [query,setQuery]=useState(""); const [results,setResults]=useState<CustomerSearchResult[]>([]); const [selected,setSelected]=useState<CustomerSnapshot|null>(null); const [qty,setQty]=useState(1); const [message,setMessage]=useState(""); const [busy,setBusy]=useState(false);
  const [view,setView]=useState<OperationView>("attend"); const [movements,setMovements]=useState<Movement[]>([]); const [team,setTeam]=useState<StaffMember[]>([]);
  const search = useCallback(async(term=query)=>{
    setBusy(true); setMessage(""); setSelected(null); const supabase=requireSupabase();
    const {data:profiles,error:profilesError}=await supabase.from("profiles").select("id,full_name,phone_e164,email,updated_at").order("updated_at",{ascending:false}).limit(200);
    if(profilesError){setBusy(false);setMessage(profilesError.message);return;}
    const matched=(profiles||[]).filter(profile=>matchesCustomerSearch(profile,term)).slice(0,30);
    setResults(matched.map(profile=>({profile_id:profile.id,full_name:profile.full_name,phone_e164:profile.phone_e164,email:profile.email})));
    setBusy(false);
  },[query]);
  const openCustomer=useCallback(async(customer:CustomerSearchResult)=>{
    setBusy(true); setMessage(""); const supabase=requireSupabase();
    const {data:memberships,error:membershipsError}=await supabase.from("account_memberships").select("account_id,is_primary").eq("profile_id",customer.profile_id).eq("active",true);
    if(membershipsError){setBusy(false);setMessage(membershipsError.message);return;}
    const accountId=memberships?.find(item=>item.is_primary)?.account_id||memberships?.[0]?.account_id;
    if(!accountId){setBusy(false);setMessage("Este cadastro ainda não possui uma conta fidelidade ativa.");return;}
    const {data:track,error:trackError}=await supabase.from("loyalty_tracks").select("id,current_progress,completed_cards").eq("account_id",accountId).eq("kind","main").maybeSingle();
    if(trackError){setBusy(false);setMessage(trackError.message);return;}
    const {data:rewards,error:rewardsError}=track?await supabase.from("rewards").select("id").eq("track_id",track.id).eq("status","available").order("issued_at",{ascending:true}):{data:[],error:null};
    if(rewardsError){setBusy(false);setMessage(rewardsError.message);return;}
    setSelected({...customer,account_id:accountId,current_progress:track?.current_progress||0,completed_cards:track?.completed_cards||0,available_rewards:rewards?.length||0,available_reward_id:rewards?.[0]?.id||null});
    setView("attend"); setBusy(false);
  },[]);
  useEffect(()=>{void (async()=>{const {data}=await requireSupabase().from("staff_members").select("role,active").eq("user_id",session.user.id).maybeSingle();setAuthorized(Boolean(data?.active));setRole(data?.role||"");if(data?.active)await search("");})();},[session.user.id]);
  const refreshSelected=async()=>{if(selected)await openCustomer(selected);};
  const openView=async(next:OperationView)=>{setView(next);setSelected(null);setMessage("");if(next==="customers")await search("");if(next==="movements"){const {data,error}=await requireSupabase().from("ledger_entries").select("id,reason,stamps_delta,created_at,subject_profile_id").order("created_at",{ascending:false}).limit(50);if(error)setMessage(error.message);else setMovements((data||[]) as Movement[]);}if(next==="team"){const supabase=requireSupabase();const {data,error}=await supabase.from("staff_members").select("user_id,role,active").order("created_at");if(error){setMessage(error.message);return;}const ids=(data||[]).map(item=>item.user_id);const {data:profiles}=ids.length?await supabase.from("profiles").select("id,full_name").in("id",ids):{data:[]};setTeam((data||[]).map(item=>({...item,display_name:profiles?.find(profile=>profile.id===item.user_id)?.full_name||"Membro da equipe"})));}};
  const purchase=async()=>{if(!selected)return;setBusy(true);setMessage("");const {data,error}=await requireSupabase().rpc("staff_record_purchase",{account_id:selected.account_id,participant_profile_id:selected.profile_id,quantity:qty,idempotency_key:crypto.randomUUID(),referral_code:null});setBusy(false);if(error)setMessage(error.message);else{setMessage(data?.referral_confirmed?`${qty} carimbo(s) da compra registrados. A indicação vinculada também foi confirmada automaticamente.`:`${qty} carimbo(s) registrado(s) com sucesso.`);setQty(1);await refreshSelected();}};
  const redeem=async()=>{if(!selected?.available_reward_id)return;setBusy(true);const {error}=await requireSupabase().rpc("staff_redeem_reward",{reward_id:selected.available_reward_id,premium_upgrade:false,price_difference:0,idempotency_key:crypto.randomUUID()});setBusy(false);if(error)setMessage(error.message);else{setMessage("Prêmio resgatado. O novo cartão continua acumulando normalmente.");await refreshSelected();}};
  if(authorized===null)return <main className="access-loading"><Brand label="Adoce Operação"/><p>Validando seu acesso...</p></main>;
  if(!authorized)return <main className="access-loading"><Brand label="Adoce Operação"/><ShieldCheck/><h1>Acesso reservado à equipe</h1><p>Este e-mail não possui uma função ativa na operação.</p><button onClick={()=>void signOut()}>Sair</button></main>;
  const customerList=<div className="operation-results">{results.map(customer=><button key={customer.profile_id} onClick={()=>void openCustomer(customer)}><span className="avatar">{customer.full_name[0]}</span><span><strong>{customer.full_name}</strong><small>{customer.phone_e164||customer.email||"Contato não informado"}</small></span><span><small>Abrir cadastro</small></span><ArrowRight/></button>)}</div>;
  return <main className="operation-home"><header><Brand label="Adoce Operação"/><div><span>{role === "owner" ? "Proprietário" : role === "manager" ? "Gerente" : "Atendimento"}</span><button onClick={()=>void signOut()}><LogOut/> Sair</button></div></header><div className="operation-shell"><aside><button className={view==="attend"?"active":""} onClick={()=>void openView("attend")}><Search/> Atender cliente</button><button className={view==="movements"?"active":""} onClick={()=>void openView("movements")}><History/> Movimentações</button><button className={view==="customers"?"active":""} onClick={()=>void openView("customers")}><Users/> Clientes</button><button className={view==="team"?"active":""} onClick={()=>void openView("team")}><ShieldCheck/> Equipe</button></aside><section className="operation-work">
    {view==="attend"&&<><div className="operation-title"><div><span>Atendimento</span><h1>Localizar cliente</h1><p>Digite apenas uma parte do nome, telefone ou e-mail.</p></div><div className="operation-role"><Check/> Acesso verificado</div></div><form className="operation-search" onSubmit={e=>{e.preventDefault();void search()}}><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Ex.: Ana, 8215 ou ana@email.com"/><button disabled={busy}>{busy?"Buscando...":"Buscar"}</button></form>{!selected?customerList:<div className="operation-customer"><button className="back" onClick={()=>setSelected(null)}>← Voltar à busca</button><div className="customer-top"><span className="avatar">{selected.full_name[0]}</span><div><small>Cliente</small><h2>{selected.full_name}</h2><p>{selected.phone_e164||selected.email}</p></div><div className="customer-progress"><strong>{selected.current_progress}</strong><span>de 14</span></div></div><div className="operation-actions"><article><Plus/><h3>Registrar compra</h3><p>Cada fatia comprada vale um carimbo. Se houver uma indicação aguardando, ela será confirmada automaticamente.</p><div className="stepper"><button onClick={()=>setQty(Math.max(1,qty-1))}>−</button><strong>{qty}</strong><button onClick={()=>setQty(qty+1)}>+</button></div><button className="access-primary" onClick={()=>void purchase()} disabled={busy}>Confirmar {qty} carimbo(s)</button></article><article><Gift/><h3>Resgatar prêmio</h3><p>Fatia tradicional ou premium com pagamento da diferença.</p><strong className="reward-total">{selected.available_rewards} disponível(is)</strong><button className="access-secondary" onClick={()=>void redeem()} disabled={busy||!selected.available_reward_id}>Confirmar fatia tradicional</button></article></div></div>}</>}
    {view==="customers"&&<><div className="operation-title"><div><span>Relacionamento</span><h1>Clientes</h1><p>Lista das contas cadastradas no Clube Adoce.</p></div></div><form className="operation-search" onSubmit={e=>{e.preventDefault();void search()}}><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Filtrar clientes"/><button disabled={busy}>Filtrar</button></form>{customerList}</>}
    {view==="movements"&&<><div className="operation-title"><div><span>Auditoria</span><h1>Movimentações</h1><p>Compras, indicações e ajustes mais recentes.</p></div></div><div className="operation-simple-list">{movements.length?movements.map(item=><article key={item.id}><History/><span><strong>{item.reason.replaceAll("_"," ")}</strong><small>{new Date(item.created_at).toLocaleString("pt-BR")}</small></span><b className={item.stamps_delta>=0?"positive":"negative"}>{item.stamps_delta>0?"+":""}{item.stamps_delta}</b></article>):<p>Nenhuma movimentação registrada ainda.</p>}</div></>}
    {view==="team"&&<><div className="operation-title"><div><span>Acessos</span><h1>Equipe</h1><p>Proprietários, gerentes e atendimento autorizados.</p></div></div><div className="operation-simple-list">{team.map(member=><article key={member.user_id}><ShieldCheck/><span><strong>{member.display_name}</strong><small>{member.role==="owner"?"Proprietário":member.role==="manager"?"Gerente":"Atendimento"}</small></span><b>{member.active?"Ativo":"Inativo"}</b></article>)}</div></>}
    {message&&<div className="operation-toast"><Check/>{message}</div>}</section></div></main>;
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
