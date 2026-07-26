import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronRight,
  Gift,
  Heart,
  History,
  LayoutDashboard,
  LogOut,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  UserPlus,
  Users,
} from "lucide-react";
import {
  type Customer,
  cycleProgress,
  earn,
  formatPhone,
  maskPhone,
  redeem,
  remainingFor,
  rewardsFor,
} from "./domain";
import { loadCustomers, saveCustomers } from "./store";

type Page = "join" | "card" | "staff" | "admin";

const moneyless = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function Brand({ compact = false }: { compact?: boolean }) {
  return <div className="brand">
    <img src="/site/logo.webp" alt="Adoce Brigaderia" />
    <div><strong>Clube Adoce</strong>{!compact && <span>Adoce Brigaderia</span>}</div>
  </div>;
}

function Card({ customer, onBack }: { customer: Customer; onBack?: () => void }) {
  const [qr, setQr] = useState("");
  const rewards = rewardsFor(customer.balance);
  const progress = cycleProgress(customer.balance);

  useEffect(() => {
    void QRCode.toDataURL(`${location.origin}/c/${customer.token}`, {
      width: 320,
      margin: 1,
      color: { dark: "#1A0C08", light: "#FFF7ED" },
    }).then(setQr);
  }, [customer.token]);

  const status = rewards
    ? `${rewards} ${rewards === 1 ? "recompensa disponível" : "recompensas disponíveis"}`
    : progress === 0
      ? "Comece hoje a juntar seus carimbos"
      : progress === 13
        ? "Falta só 1 para sua recompensa"
        : `Faltam ${remainingFor(customer.balance)} para sua recompensa`;

  return <main className="page card-page">
    <header className="simple-header">
      {onBack && <button className="icon-button" onClick={onBack} aria-label="Voltar"><ArrowLeft /></button>}
      <Brand compact />
      <button className="icon-button" aria-label="Ajuda"><Heart /></button>
    </header>
    <section className="wallet-card" aria-label={`Cartão de ${customer.name}`}>
      <div className="card-photo"><img src="/site/hero-cake.webp" alt="Fatia artesanal de chocolate com morango" /></div>
      <div className="card-title"><img src="/site/logo.webp" alt="" /><div><span>Clube</span><strong>Adoce</strong></div></div>
      <div className="member"><span>Membro</span><strong>{customer.name}</strong></div>
      <div className="balance"><strong>{progress}</strong><span>de 14<br />carimbos</span></div>
      <div className="stamps">{Array.from({ length: 14 }, (_, index) => <span key={index} className={index < progress ? "filled" : ""}><Heart /></span>)}</div>
      <div className={`card-message ${rewards ? "reward" : ""}`}>{rewards ? <Gift /> : <Heart />}<strong>{status}</strong></div>
    </section>
    <section className="identity-panel">
      <div><h2>Seu Clube Adoce está pronto</h2><p>Apresente este código no atendimento. Ele identifica sua conta, mas não movimenta o saldo.</p></div>
      {qr && <img className="qr" src={qr} alt="QR Code pessoal" />}
      <span>{maskPhone(customer.phone)}</span>
    </section>
    <div className="wallet-actions">
      <button className="wallet-button apple"><Smartphone /> Adicionar à Apple Wallet <small>modo demonstração</small></button>
      <button className="wallet-button google"><Smartphone /> Adicionar ao Google Wallet <small>modo demonstração</small></button>
    </div>
    <details className="how"><summary>Como funciona <ChevronRight /></summary><ol><li>Toda fatia comprada, tradicional ou premium, vale 1 carimbo.</li><li>Complete 14 e ganhe uma fatia tradicional.</li><li>Prefere uma premium? Pague somente a diferença.</li><li>O prêmio fica disponível enquanto o novo cartão continua.</li></ol></details>
  </main>;
}

function Join({ onCreated, goStaff }: { onCreated: (customer: Customer) => void; goStaff: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [error, setError] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || phone.length < 10 || !terms || !privacy) {
      setError("Preencha nome e telefone e aceite os termos e a política de privacidade.");
      return;
    }
    const existing = loadCustomers().find((customer) => customer.phone === phone);
    if (existing) {
      setError("Já existe um cartão para este telefone. Abrimos o cartão existente.");
      setTimeout(() => onCreated(existing), 900);
      return;
    }
    const customer: Customer = {
      id: crypto.randomUUID(),
      name: name.trim(),
      phone,
      email: email || undefined,
      balance: 0,
      token: `adoce_${crypto.randomUUID().replaceAll("-", "")}`,
      status: "ACTIVE",
      marketingConsent: marketing,
      transactions: [],
    };
    saveCustomers([customer, ...loadCustomers()]);
    onCreated(customer);
  };

  return <main className="join-page">
    <nav><Brand /><button className="text-button" onClick={goStaff}>Área da equipe <ChevronRight /></button></nav>
    <section className="join-hero"><div className="hero-copy"><h1>Seu carinho agora <em>também</em> vira conquista.</h1><p>Cada fatia comprada vale 1 carimbo. Complete 14 e guarde sua recompensa no celular, para usar quando quiser.</p><div className="mini-benefits"><span><Heart /> 1 fatia = 1 carimbo</span><span><Gift /> Prêmio no seu tempo</span><span><Smartphone /> Cartão digital</span></div></div><div className="hero-photo"><img src="/site/hero-cake.webp" alt="Fatia de chocolate com morango da Adoce" /></div></section>
    <section className="join-form-wrap"><div><h2>Entre para o Clube</h2><p>Leva menos de um minuto.</p></div><form onSubmit={submit}><label>Seu nome<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="Como podemos te chamar?" /></label><label>WhatsApp ou telefone<input value={phone} onChange={(event) => setPhone(formatPhone(event.target.value))} inputMode="tel" autoComplete="tel" placeholder="DDD + número" /></label><label>E-mail <span>(opcional)</span><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" placeholder="voce@exemplo.com" /></label><label className="check"><input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} /><span>Aceito os termos do programa.</span></label><label className="check"><input type="checkbox" checked={privacy} onChange={(event) => setPrivacy(event.target.checked)} /><span>Li e aceito a política de privacidade.</span></label><label className="check optional"><input type="checkbox" checked={marketing} onChange={(event) => setMarketing(event.target.checked)} /><span>Quero receber novidades e promoções. (opcional)</span></label>{error && <div className="form-error" role="alert">{error}</div>}<button className="primary" type="submit">Criar meu Clube Adoce <ChevronRight /></button></form></section>
    <footer><Brand compact /><p>Feito com amor em cada detalhe.</p></footer>
  </main>;
}

function Staff({ customers, update, back }: { customers: Customer[]; update: (customer: Customer) => void; back: () => void }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [toast, setToast] = useState("");
  const filtered = customers.filter((customer) => `${customer.name} ${customer.phone}`.toLowerCase().includes(query.toLowerCase()));

  const commit = (kind: "earn" | "redeem") => {
    if (!selected) return;
    try {
      const next = kind === "earn" ? earn(selected, quantity) : redeem(selected);
      update(next);
      setSelected(next);
      setToast(kind === "earn" ? `${quantity} carimbo(s) adicionados.` : "Recompensa resgatada. O cartão atual continua preservado.");
      setTimeout(() => setToast(""), 3200);
    } catch {
      setToast("Saldo insuficiente para o resgate.");
    }
  };

  return <main className="staff-page"><header className="staff-header"><Brand compact /><span>Atendimento</span><button className="icon-button" onClick={back} aria-label="Sair"><LogOut /></button></header><div className="staff-shell"><aside><button className="active"><Camera /> Atender cliente</button><button><History /> Movimentações</button><button><Users /> Clientes</button></aside><section className="service"><div className="service-head"><div><h1>Atender cliente</h1><p>Escaneie o QR pessoal ou busque pelo telefone.</p></div><button className="scan-button"><Camera /> Escanear cartão</button></div><label className="search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome ou telefone" /></label>{query && !selected && <div className="search-results">{filtered.map((customer) => <button key={customer.id} onClick={() => setSelected(customer)}><span><strong>{customer.name}</strong><small>{maskPhone(customer.phone)}</small></span><span>{customer.balance} carimbos <ChevronRight /></span></button>)}</div>}{selected && <div className="customer-workspace"><div className="customer-summary"><div className="avatar">{selected.name[0]}</div><div><span>Cliente</span><h2>{selected.name}</h2><p>{maskPhone(selected.phone)} · Conta ativa</p></div><button className="text-button" onClick={() => setSelected(null)}>Trocar</button></div><div className="balance-strip"><div><span>Progresso atual</span><strong>{cycleProgress(selected.balance)}</strong><small>de 14 carimbos</small></div><div><span>Recompensas</span><strong>{rewardsFor(selected.balance)}</strong><small>disponíveis</small></div><div><span>Próxima recompensa</span><strong>{remainingFor(selected.balance)}</strong><small>carimbos</small></div></div><div className="operations"><section><h3>Adicionar carimbos</h3><p>Toda fatia paga, tradicional ou premium, vale 1 carimbo.</p><div className="stepper"><button onClick={() => setQuantity(Math.max(1, quantity - 1))}>−</button><strong>{quantity}</strong><button onClick={() => setQuantity(quantity + 1)}>+</button></div><button className="primary" onClick={() => commit("earn")}><Plus /> Confirmar carimbos</button></section><section><h3>Resgatar recompensa</h3><p>O resgate usa 1 prêmio disponível e não altera o cartão atual.</p><div className="reward-count"><Gift /><strong>{rewardsFor(selected.balance)}</strong><span>fatia(s) disponível(is)</span></div><button className="secondary" disabled={selected.balance < 14} onClick={() => commit("redeem")}><Gift /> Confirmar resgate</button></section></div><div className="ledger"><h3>Últimas movimentações</h3>{selected.transactions.length === 0 ? <p>Nenhuma movimentação recente.</p> : selected.transactions.slice(0, 5).map((transaction) => <div key={transaction.id}><span className={transaction.pointsDelta > 0 ? "positive" : "negative"}>{transaction.pointsDelta > 0 ? "+" : ""}{transaction.pointsDelta}</span><span><strong>{transaction.type}</strong><small>{moneyless.format(new Date(transaction.createdAt))}</small></span><strong>{transaction.resultingBalance}</strong></div>)}</div></div>}</section></div>{toast && <div className="toast"><Check />{toast}</div>}</main>;
}

function Admin({ customers, back }: { customers: Customer[]; back: () => void }) {
  const total = customers.reduce((sum, customer) => sum + cycleProgress(customer.balance), 0);
  return <main className="admin-page"><aside className="admin-nav"><Brand compact /><nav><button className="active"><LayoutDashboard /> Visão geral</button><button><Users /> Clientes</button><button><History /> Movimentações</button><button><ShieldCheck /> Equipe</button><button><Settings /> Configurações</button></nav><button onClick={back}><LogOut /> Sair</button></aside><section className="admin-main"><header><div><span>Painel administrativo</span><h1>Visão geral</h1></div><div className="admin-user">Rubens <span>OWNER</span></div></header><div className="metrics"><div><span>Clientes ativos</span><strong>{customers.length}</strong><small>contas de demonstração</small></div><div><span>Carimbos nos cartões atuais</span><strong>{total}</strong><small>progresso em andamento</small></div><div><span>Recompensas disponíveis</span><strong>{customers.reduce((sum, customer) => sum + rewardsFor(customer.balance), 0)}</strong><small>prêmios liberados</small></div><div><span>Próximos da recompensa</span><strong>{customers.filter((customer) => remainingFor(customer.balance) <= 3).length}</strong><small>até 3 carimbos</small></div></div><section className="admin-table"><div className="table-head"><div><h2>Clientes</h2><p>Contas e saldos do programa</p></div><button className="secondary"><UserPlus /> Novo cliente</button></div><div className="table-row table-label"><span>Cliente</span><span>Telefone</span><span>Progresso</span><span>Recompensas</span><span>Status</span></div>{customers.map((customer) => <div className="table-row" key={customer.id}><span><strong>{customer.name}</strong><small>{customer.email || "Sem e-mail"}</small></span><span>{maskPhone(customer.phone)}</span><span>{cycleProgress(customer.balance)}/14</span><span>{rewardsFor(customer.balance)}</span><span className="status">Ativa</span></div>)}</section></section></main>;
}

export default function LegacyPrototype() {
  const seeded = useMemo(loadCustomers, []);
  const [page, setPage] = useState<Page>(() => location.hash.includes("card-demo") ? "card" : location.hash.includes("staff") ? "staff" : location.hash.includes("admin") ? "admin" : "join");
  const [customers, setCustomers] = useState(seeded);
  const [current, setCurrent] = useState<Customer | null>(() => location.hash.includes("card-demo") ? seeded.find((customer) => customer.balance === 14) || seeded[0] : null);

  const update = (customer: Customer) => {
    const next = customers.map((item) => item.id === customer.id ? customer : item);
    setCustomers(next);
    saveCustomers(next);
    setCurrent(customer);
  };
  const navigate = (nextPage: Page) => {
    setPage(nextPage);
    location.hash = nextPage;
  };

  useEffect(() => {
    const refresh = () => setPage(location.hash.includes("card-demo") ? "card" : location.hash.includes("staff") ? "staff" : location.hash.includes("admin") ? "admin" : "join");
    addEventListener("hashchange", refresh);
    return () => removeEventListener("hashchange", refresh);
  }, []);

  if (page === "card" && current) return <Card customer={current} onBack={() => navigate("join")} />;
  if (page === "staff") return <Staff customers={customers} update={update} back={() => navigate("join")} />;
  if (page === "admin") return <Admin customers={customers} back={() => navigate("join")} />;
  return <Join onCreated={(customer) => { setCurrent(customer); navigate("card"); }} goStaff={() => navigate("staff")} />;
}
