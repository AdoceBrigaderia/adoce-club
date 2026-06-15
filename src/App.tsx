import { useState } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  BarChart3, CakeSlice, Check, CheckCircle2, ChevronRight, Copy, Gift, Heart,
  Minus, MoreHorizontal, Plus, ScanLine, Settings, Share2, Store,
  Truck, Users, WalletCards,
} from 'lucide-react';
import { AppShell } from './components/AppShell';
import { LoyaltyCard } from './components/LoyaltyCard';
import { Payment, Sale, useStore } from './store';

const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const payments: Payment[] = ['Dinheiro', 'Pix', 'Cartão', 'Cortesia', 'Fidelidade'];

function OrnamentTitle({ children }: { children: React.ReactNode }) {
  return <div className="ornament-title"><span>❧</span><h2>{children}</h2><span>❧</span></div>;
}

function Login() {
  const navigate = useNavigate();
  const setRole = useStore(state => state.setRole);
  const enter = (role: 'cliente' | 'vendedor' | 'admin') => { setRole(role); navigate(`/${role}`); };
  return <div className="login-screen"><div className="login-glow"/><img src="/assets/logo-adoce.jpeg" alt="Adoce Brigaderia"/><h1>Adoce Club</h1><p>Doces momentos, mais vantagens!</p><div className="login-card"><button className="primary-button" onClick={() => enter('cliente')}><Heart/> Entrar como Cliente</button><button onClick={() => enter('vendedor')}><Store/> Entrar como Vendedor</button><button onClick={() => enter('admin')}><BarChart3/> Entrar como Sócio / Admin</button></div><small>Ambiente demonstrativo, sem dados reais.</small></div>;
}

function ClientHome() {
  return <AppShell><LoyaltyCard compact/><Link className="primary-button scan-button" to="/cliente/resgatar/ADOCE-A11"><ScanLine/> Escanear QR Code</Link><OrnamentTitle>Sabores da Semana</OrnamentTitle><section className="soft-card flavor-card"><img src="/assets/carimbo-fatia.png" alt="Fatia de torta de chocolate"/><ul><li>Ninho com Morango</li><li>Brigadeiro Clássico</li><li>Beijinho</li><li>Chocolate Belga</li></ul><div className="floating-heart">♡</div></section><div className="quick-panels"><Link className="soft-card quick-panel" to="/cliente/familia"><Users/><div><b>Cartão Familiar</b><span>Compartilhe<br/>seus carimbos</span></div><ChevronRight/></Link><Link className="soft-card quick-panel" to="/cliente/indicacoes"><Gift/><div><b>Indique Amigos</b><span>E ganhe benefícios<br/>deliciosos!</span></div><ChevronRight/></Link></div></AppShell>;
}

function CardPage() {
  const reward = useStore(state => state.reward);
  return <AppShell>{reward > 0 && <section className="success-banner"><Check/><div><b>Fatia premiada!</b><span>Sua próxima fatia será por nossa conta.</span></div></section>}<LoyaltyCard/><section className="soft-card history-card"><OrnamentTitle>Histórico recente</OrnamentTitle><p><Heart fill="currentColor"/> +2 carimbos <span>Compra presencial</span></p><p><Heart fill="currentColor"/> +3 carimbos <span>Compra por delivery</span></p></section></AppShell>;
}

function FamilyReferralPanel() {
  const family = useStore(state => state.family);
  const createFamily = useStore(state => state.createFamily);
  const joinFamily = useStore(state => state.joinFamily);
  const referralCode = useStore(state => state.referralCode);
  const referralBonus = useStore(state => state.referralBonus);
  const activateReferral = useStore(state => state.activateReferral);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState('');

  return <>
    <section className="soft-card family-panel">
      <OrnamentTitle>Cartão Familiar</OrnamentTitle>
      <p className="center-copy">Todos os membros compartilham os carimbos <Heart size={13} fill="currentColor"/></p>
      {family ? <><div className="family-row"><Users/><b>{family.name}</b><div className="avatars">{family.members.map(member => <span key={member}>{member.slice(0, 2).toUpperCase()}</span>)}</div></div><LoyaltyCard compact family/><button className="invite-code" onClick={() => { navigator.clipboard?.writeText(family.code); setCopied('Código da família copiado.'); }}>{family.code}<Copy/></button></> : <div className="family-actions"><button className="primary-button" onClick={createFamily}>Criar cartão familiar</button><span>ou entre com um convite</span><div><input aria-label="Código da família" placeholder="Código da família" value={code} onChange={event => setCode(event.target.value)}/><button onClick={() => setMessage(joinFamily(code) ? 'Você entrou na família!' : 'Código não encontrado')}>Entrar</button></div></div>}
      {(message || copied) && <p className="inline-notice">{message || copied}</p>}
    </section>
    <section className="soft-card referral-panel"><div className="gift-illustration"><Gift/><span>♥</span></div><OrnamentTitle>Indique Amigos</OrnamentTitle><p>Convide amigos e ganhe benefícios deliciosos!</p><label>Seu código de convite</label><button className="invite-code" onClick={() => { navigator.clipboard?.writeText(referralCode); setCopied('Código de indicação copiado.'); }}>{referralCode}<Copy/></button><button className="primary-button share-button" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Venha para o Adoce Club! Use meu código ${referralCode}`)}`)}><Share2/> Compartilhar convite</button><small>Quando seu amigo fizer a 1ª compra,<br/>você ganha +1 carimbo <Heart size={12} fill="currentColor"/></small><button className="simulate-button" onClick={activateReferral} disabled={referralBonus}>{referralBonus ? 'Bônus já liberado' : 'Simular primeira compra do indicado'}</button></section>
    <section className="soft-card birthday-card"><CakeSlice/><div><b>Semana do seu aniversário</b><span>Desconto especial em 1 fatia</span></div><ChevronRight/></section>
  </>;
}

function Family() { return <AppShell><FamilyReferralPanel/></AppShell>; }
function Referrals() { return <AppShell><FamilyReferralPanel/></AppShell>; }

function Redeem() {
  const { token = '' } = useParams();
  const claim = useStore(state => state.claim);
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  return <AppShell><section className="soft-card redeem-card"><div className="success-medal"><Check/></div><OrnamentTitle>Resgatar carimbos</OrnamentTitle><p>Seu mimo está quase lá!</p><div className="token-box">{token}</div><button className="primary-button" onClick={() => setStatus(claim(token) ? 'Carimbos adicionados com sucesso!' : 'Este token é inválido ou já foi usado.')}>Receber carimbos</button>{status && <div className="inline-notice"><CheckCircle2/>{status}</div>}<button className="text-button" onClick={() => navigate('/cliente/cartao')}>Ver meu cartão</button></section></AppShell>;
}

function MetricCard({ label, value, note, icon }: { label: string; value: string; note: string; icon: React.ReactNode }) {
  return <div className="metric-card"><span>{label}</span>{icon}<b>{value}</b><small>{note}</small></div>;
}

function SellerSalePanel({ embedded = false }: { embedded?: boolean }) {
  const { price, addSale, cashOpen } = useStore();
  const [qty, setQty] = useState(3);
  const [payment, setPayment] = useState<Payment>('Pix');
  const [sale, setSale] = useState<Sale | null>(null);
  const create = (kind: Sale['kind']) => setSale(addSale({ qty, value: qty * price, payment, kind, seller: 'Atendimento Demo' }));
  if (!cashOpen) return <section className="soft-card closed-sale"><Store/><h2>Abra o caixa antes da primeira venda</h2><p>Informe o fundo fixo e as fatias disponíveis para liberar a operação.</p><Link className="primary-button" to="/admin/caixa">Abrir caixa</Link></section>;
  if (sale) return <QRCard sale={sale}/>;
  return <section className={`soft-card sale-panel ${embedded ? 'embedded' : ''}`}><OrnamentTitle>Nova venda</OrnamentTitle><label>Quantidade de fatias</label><div className="quantity-row"><button aria-label="Diminuir quantidade" onClick={() => setQty(Math.max(1, qty - 1))}><Minus/></button><div>{qty}</div><button aria-label="Aumentar quantidade" onClick={() => setQty(qty + 1)}><Plus/></button><small>Valor unitário<br/><b>{money(price)}</b></small></div><div className="quick-qty">{[1, 2, 3, 4, 6, 10].map(value => <button className={qty === value ? 'active' : ''} onClick={() => setQty(value)} key={value}>{value}</button>)}</div><div className="sale-total">Total: <Heart size={15} fill="currentColor"/> <b>{money(qty * price)}</b></div><div className="payment-grid">{payments.map(item => <button className={payment === item ? 'active' : ''} onClick={() => setPayment(item)} key={item}><WalletCards/>{item}</button>)}</div><div className="sale-types"><button onClick={() => create('Presencial')}><Users/><b>Cliente Presencial</b><small>Consumir agora</small></button><button onClick={() => create('Delivery / Retirada')}><Truck/><b>Delivery / Retirada</b><small>Entregar ou retirar</small></button></div></section>;
}

function SellerHome() {
  const state = useStore();
  const sold = state.sales.reduce((sum, sale) => sum + sale.qty, 0);
  const total = state.sales.reduce((sum, sale) => sum + sale.value, 0);
  const delivery = state.sales.filter(sale => sale.kind.startsWith('Delivery')).reduce((sum, sale) => sum + sale.qty, 0);
  return <AppShell role="vendedor"><section className="soft-card cash-status"><Store/><div><b>{state.cashOpen ? 'Caixa aberto' : 'Caixa fechado'} <i/></b><span>{state.cashOpen ? 'Aberto para vendas' : 'Abra o caixa para iniciar'}</span></div><Link to="/admin/caixa">{state.cashOpen ? 'Fechar caixa' : 'Abrir caixa'}</Link></section><div className="metrics-grid"><MetricCard label="Fatias vendidas hoje" value={String(sold)} note="fatias" icon={<CakeSlice/>}/><MetricCard label="Total do dia" value={money(total)} note="em vendas" icon={<Heart fill="currentColor"/>}/><MetricCard label="Presencial x Delivery" value={`${sold - delivery} / ${delivery}`} note="presencial / delivery" icon={<Truck/>}/></div><SellerSalePanel embedded/><RecentSales compact/></AppShell>;
}

function NewSale() { return <AppShell role="vendedor"><SellerSalePanel/></AppShell>; }

function QRCard({ sale }: { sale: Sale }) {
  const link = `${location.origin}/cliente/resgatar/${sale.token}`;
  const [copied, setCopied] = useState(false);
  return <section className="soft-card qr-card"><div className="success-medal"><Check/></div><OrnamentTitle>Venda registrada!</OrnamentTitle><p>{sale.qty} fatias · {money(sale.value)} · {sale.payment}</p>{sale.kind === 'Presencial' ? <><div className="qr-frame"><QRCodeSVG value={link} size={205} fgColor="#5b201b" title="QR Code da venda"/></div><p className="qr-help">Peça ao cliente para escanear</p></> : <><div className="token-box">{sale.token}</div><button className="secondary-button" onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); }}><Copy/> Copiar link</button>{copied && <p className="inline-notice">Link copiado.</p>}<button className="primary-button" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Seus carimbos Adoce Club: ${link}`)}`)}><Share2/> Abrir WhatsApp</button></>}<div className="qr-actions"><Link to="/vendedor/nova-venda">Nova venda</Link><Link to="/vendedor/vendas-recentes">Ver vendas recentes</Link></div></section>;
}

function RecentSales({ compact = false }: { compact?: boolean }) {
  const sales = useStore(state => state.sales);
  return <section className="soft-card recent-card"><div className="recent-title"><h3>◷ Vendas recentes</h3><span><ScanLine/> Mostrar QR novamente</span></div>{sales.slice(0, compact ? 2 : 99).map(sale => <div className="sale-row" key={sale.id}><span className="sale-avatar">{sale.seller.slice(0, 2)}</span><div><b>{sale.seller}</b><small><Heart size={10} fill="currentColor"/> {sale.qty} fatias · {sale.kind}</small></div><div><b>{money(sale.value)}</b><small>{sale.payment} · {sale.createdAt}</small></div><Link aria-label={`Abrir venda ${sale.id}`} to={`/vendedor/venda/${sale.id}`}><ChevronRight/></Link></div>)}</section>;
}

function RecentPage() { return <AppShell role="vendedor"><RecentSales/></AppShell>; }
function SaleRoute() { const { id } = useParams(); const sale = useStore(state => state.sales.find(item => item.id === id)); return sale ? <AppShell role="vendedor"><QRCard sale={sale}/></AppShell> : <AppShell role="vendedor"><p>Venda não encontrada.</p></AppShell>; }

function Cash() {
  const open = useStore(state => state.openCash);
  const isOpen = useStore(state => state.cashOpen);
  const role = useStore(state => state.role);
  const [fund, setFund] = useState(100);
  const [available, setAvailable] = useState(72);
  return <AppShell role={role === 'vendedor' ? 'vendedor' : 'admin'}><section className="soft-card cash-form"><OrnamentTitle>Abertura de Caixa</OrnamentTitle><p>Prepare o festival de hoje com carinho.</p><label htmlFor="cash-fund">Fundo fixo</label><input id="cash-fund" type="number" min="0" value={fund} onChange={event => setFund(+event.target.value)}/><label htmlFor="available-slices">Fatias disponíveis hoje</label><input id="available-slices" type="number" min="0" value={available} onChange={event => setAvailable(+event.target.value)}/><button className="primary-button" disabled={isOpen || fund < 0 || available < 0} onClick={() => open(fund, available)}>{isOpen ? 'Caixa já está aberto' : 'Abrir caixa agora'}</button></section></AppShell>;
}

function Reports() {
  const state = useStore();
  const sold = state.sales.reduce((sum, sale) => sum + sale.qty, 0);
  const revenue = state.sales.reduce((sum, sale) => sum + sale.value, 0);
  const estimatedCost = sold * state.cost;
  return <AppShell role="admin"><section className="soft-card report-hero"><OrnamentTitle>Relatório do Dia</OrnamentTitle><p>Um resumo doce da operação de hoje</p><div className="report-grid"><div><span>Faturamento bruto</span><b>{money(revenue)}</b></div><div><span>Lucro bruto estimado</span><b>{money(revenue - estimatedCost)}</b></div><div><span>Fatias vendidas</span><b>{sold}</b></div><div><span>Fatias restantes</span><b>{Math.max(0, state.available - sold)}</b></div><div><span>Custo estimado</span><b>{money(estimatedCost)}</b></div><div><span>Delivery</span><b>{state.sales.filter(sale => sale.kind.startsWith('Delivery')).length}</b></div></div></section><section className="soft-card payment-report"><OrnamentTitle>Por forma de pagamento</OrnamentTitle>{payments.map(payment => <p key={payment}><span>{payment}</span><b>{money(state.sales.filter(sale => sale.payment === payment).reduce((sum, sale) => sum + sale.value, 0))}</b></p>)}</section><RecentSales/></AppShell>;
}

function Admin() {
  return <AppShell role="admin"><section className="soft-card admin-hero"><BarChart3/><OrnamentTitle>Painel Administrativo</OrnamentTitle><p>Visão geral da operação de hoje.</p></section><div className="admin-menu"><Link to="/admin/caixa"><Store/>Abertura de Caixa<ChevronRight/></Link><Link to="/admin/relatorios"><BarChart3/>Relatórios<ChevronRight/></Link><Link to="/admin/configuracoes"><Settings/>Configurações<ChevronRight/></Link><a href="/documentacao/index.html"><MoreHorizontal/>Documentação<ChevronRight/></a></div></AppShell>;
}

function Config() {
  const state = useStore();
  const [price, setPrice] = useState(state.price);
  const [cost, setCost] = useState(state.cost);
  const [saved, setSaved] = useState(false);
  return <AppShell role="admin"><section className="soft-card config-card"><OrnamentTitle>Configurações</OrnamentTitle><label htmlFor="slice-price">Preço da fatia</label><input id="slice-price" type="number" min="0" step="0.01" value={price} onChange={event => setPrice(+event.target.value)}/><label htmlFor="average-cost">Custo médio da fatia</label><input id="average-cost" type="number" min="0" step="0.01" value={cost} onChange={event => setCost(+event.target.value)}/><label htmlFor="stamps-required">Carimbos para prêmio</label><input id="stamps-required" value="14" disabled/><label htmlFor="instagram">Instagram</label><input id="instagram" defaultValue="@adocebrigaderia"/><label htmlFor="whatsapp">WhatsApp</label><input id="whatsapp" defaultValue="(11) 99999-9999"/><button className="primary-button" disabled={price < 0 || cost < 0} onClick={() => { state.setConfig(price, cost); setSaved(true); }}>Salvar configurações</button>{saved && <p className="inline-notice">Configurações salvas.</p>}</section></AppShell>;
}

export default function App() {
  return <Routes><Route path="*" element={<Login/>}/><Route path="/login" element={<Login/>}/><Route path="/cliente" element={<ClientHome/>}/><Route path="/cliente/cartao" element={<CardPage/>}/><Route path="/cliente/familia" element={<Family/>}/><Route path="/cliente/indicacoes" element={<Referrals/>}/><Route path="/cliente/resgatar/:token" element={<Redeem/>}/><Route path="/vendedor" element={<SellerHome/>}/><Route path="/vendedor/nova-venda" element={<NewSale/>}/><Route path="/vendedor/vendas-recentes" element={<RecentPage/>}/><Route path="/vendedor/venda/:id" element={<SaleRoute/>}/><Route path="/admin" element={<Admin/>}/><Route path="/admin/caixa" element={<Cash/>}/><Route path="/admin/relatorios" element={<Reports/>}/><Route path="/admin/configuracoes" element={<Config/>}/></Routes>;
}
