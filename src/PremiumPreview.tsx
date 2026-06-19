import { useMemo, useState } from 'react';
import { BadgeCheck, Bell, CakeSlice, Check, ChevronRight, Clock3, Gift, Heart, MapPin, Minus, Plus, QrCode, Search, ShoppingBag, Sparkles, Store, Truck, Users, WalletCards } from 'lucide-react';
import './styles/premium-preview.css';

type Item = { name: string; short: string; price: number; stock: number; color: string; accent: string; tag: string };
type Tab = 'Vitrine' | 'Compra' | 'Pedido' | 'Clube' | 'Caixa' | 'Gestor';

const premiumLogo = '/assets/branding/adoce-club-premium-logo.svg';
const flavors: Item[] = [
  { name: 'Chocolatudo', short: 'Choco', price: 16, stock: 18, color: '#5b211c', accent: '#ff4f93', tag: 'intenso' },
  { name: 'Trufado de ninho com morangos', short: 'Ninho', price: 16, stock: 12, color: '#fff4dd', accent: '#e8437f', tag: 'queridinho' },
  { name: 'Ferrero Rocher', short: 'Ferrero', price: 16, stock: 9, color: '#8a4b20', accent: '#f5b44c', tag: 'premium' },
  { name: 'Redvelvet com geleia', short: 'Red', price: 16, stock: 7, color: '#9a1730', accent: '#ff6a9f', tag: 'especial' },
  { name: 'Mousse de limao', short: 'Limao', price: 16, stock: 6, color: '#dff59c', accent: '#5fae38', tag: 'leve' },
  { name: 'Ninho com Nutella', short: 'Nutella', price: 16, stock: 10, color: '#f6e7c8', accent: '#6b2b1f', tag: 'cremoso' },
];

function SliceArt({ item, small = false }: { item: Item; small?: boolean }) {
  return <span className={`pp-slice ${small ? 'small' : ''}`} style={{ ['--slice' as string]: item.color, ['--accent' as string]: item.accent }}><i/><b/><em/></span>;
}

function PremiumTabs({ tab, setTab }: { tab: Tab; setTab: (tab: Tab) => void }) {
  const tabs: Tab[] = ['Vitrine', 'Compra', 'Pedido', 'Clube', 'Caixa', 'Gestor'];
  return <nav className="pp-tabs" aria-label="Ambiente premium">{tabs.map(item => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item}</button>)}</nav>;
}

function BrandLockup() {
  return <div className="pp-brand"><img src={premiumLogo} alt="Adoce Club"/><div><b>Adoce Club</b><span>Festival de fatias</span></div></div>;
}

function CustomerHome({ setTab }: { setTab: (tab: Tab) => void }) {
  return <section className="pp-phone pp-home">
    <header className="pp-top">
      <BrandLockup/>
      <button><Bell/><i>3</i></button>
    </header>
    <div className="pp-location"><span>Boa noite, Rubens</span><b>Festival de fatias Adoce Brigaderia</b><MapPin/></div>
    <button className="pp-coupon"><Gift/> Voce ganhou 2 carimbos beta <ChevronRight/></button>
    <nav className="pp-categories">
      {['Sabores','Promos','Prêmios','Rota'].map((label, index) => <button key={label}>{index === 0 ? <CakeSlice/> : index === 1 ? <Sparkles/> : index === 2 ? <BadgeCheck/> : <MapPin/>}<span>{label}</span></button>)}
    </nav>
    <section className="pp-hero">
      <div>
        <span>Hoje as 19h</span>
        <h1>Escolha suas fatias antes da fila.</h1>
        <p>Monte a cestinha, acompanhe a separacao e receba seus carimbos.</p>
        <button onClick={() => setTab('Compra')}>Montar minha cestinha</button>
      </div>
      <SliceArt item={flavors[1]}/>
    </section>
    <section className="pp-loyalty">
      <div><Heart/> <b>8 de 14 carimbos</b><button onClick={() => setTab('Clube')}>Ver clube</button></div>
      <span><i style={{ width: '57%' }}/></span>
    </section>
    <div className="pp-section-title"><h2>Sabores de hoje</h2><button onClick={() => setTab('Compra')}>Ver todos</button></div>
    <div className="pp-product-row">{flavors.slice(0,3).map(item => <article key={item.name} className="pp-product"><SliceArt item={item} small/><b>{item.short}</b><span>{item.stock} disp.</span></article>)}</div>
    <footer className="pp-nav"><b>Inicio</b><span>Cardapio</span><span>Cestinha</span><span>Clube</span></footer>
  </section>;
}

function PurchaseFlow({ setTab }: { setTab: (tab: Tab) => void }) {
  const [cart, setCart] = useState<Record<string, number>>({ Chocolatudo: 1, Ferrero: 1 });
  const total = useMemo(() => Object.values(cart).reduce((a, b) => a + b, 0), [cart]);
  const amount = total * 16;
  const change = (short: string, delta: number) => setCart(current => ({ ...current, [short]: Math.max(0, (current[short] || 0) + delta) }));
  return <section className="pp-phone pp-cart">
    <header className="pp-top compact"><BrandLockup/><ShoppingBag/></header>
    <div className="pp-search"><Search/> Buscar sabor, calda ou promocao</div>
    <div className="pp-flavor-grid">{flavors.map(item => <button key={item.name} onClick={() => change(item.short, 1)}><SliceArt item={item} small/><b>{item.short}</b><span>{item.stock} fatias</span><em>{item.tag}</em></button>)}</div>
    <section className="pp-basket">
      <h2>Cestinha</h2>
      {flavors.filter(item => cart[item.short]).map(item => <div className="pp-basket-row" key={item.short}>
        <SliceArt item={item} small/><div><b>{item.name}</b><span>Calda: Leite Ninho</span></div>
        <button onClick={() => change(item.short, -1)}><Minus/></button><strong>{cart[item.short]}</strong><button onClick={() => change(item.short, 1)}><Plus/></button>
      </div>)}
      <div className="pp-total"><span>{total} fatias</span><b>{amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b></div>
      <button className="pp-primary" onClick={() => setTab('Pedido')}>Fechar compra</button>
    </section>
  </section>;
}

function OrderTracking() {
  const steps = ['Pedido recebido', 'Separando fatias', 'Aguardando pagamento', 'Pronto para retirada'];
  return <section className="pp-phone pp-track">
    <header className="pp-top compact"><BrandLockup/><Clock3/></header>
    <section className="pp-order-hero"><QrCode/><span>Pedido AC-1048</span><h1>Estamos separando suas fatias.</h1><p>Quando estiver pronto, voce recebe o aviso para buscar na barraquinha.</p></section>
    <div className="pp-timeline">{steps.map((step, index) => <div key={step} className={index < 2 ? 'done' : index === 2 ? 'active' : ''}><i>{index < 2 ? <Check/> : index + 1}</i><span>{step}</span><small>{index === 1 ? 'agora' : index === 2 ? 'proximo passo' : 'ok'}</small></div>)}</div>
    <section className="pp-order-card"><h2>Itens reservados</h2><p>2x Chocolatudo</p><p>1x Ferrero Rocher</p><p>Calda: Leite Ninho</p><button className="pp-primary">Falar no WhatsApp</button></section>
  </section>;
}

function ClubFlow() {
  return <section className="pp-phone pp-club">
    <header className="pp-top compact"><BrandLockup/><Gift/></header>
    <section className="pp-club-hero"><BadgeCheck/><h1>Seu clube de vantagens</h1><p>Faltam 6 carimbos para sua fatia premiada.</p></section>
    <div className="pp-stamp-grid">{Array.from({ length: 14 }).map((_, index) => <span key={index} className={index < 8 ? 'filled' : ''}>{index < 8 ? <SliceArt item={flavors[0]} small/> : index + 1}</span>)}</div>
    <section className="pp-rewards"><h2>Prêmios e selos</h2><div><Gift/><b>Fatia premiada</b><span>1 prêmio pendente</span></div><div><Users/><b>Familia doce</b><span>Compartilhe carimbos</span></div></section>
  </section>;
}

function OperatorFlow() {
  const [cart, setCart] = useState<Record<string, number>>({});
  const total = Object.values(cart).reduce((a, b) => a + b, 0);
  const add = (short: string) => setCart(current => ({ ...current, [short]: (current[short] || 0) + 1 }));
  return <section className="pp-tablet">
    <aside><img src={premiumLogo} alt="Adoce Club"/><h1>Caixa aberto</h1><p>Rubens · Festival de fatias</p><div><b>Reservas online</b><span>5 para separar</span></div><div><b>Fatias restantes</b><span>62 no estoque</span></div></aside>
    <main><header><div><span>Venda rapida</span><h2>Toque nos sabores da compra</h2></div><button><Truck/> Reservas</button></header>
      <div className="pp-pos-grid">{flavors.map(item => <button key={item.name} onClick={() => add(item.short)}><SliceArt item={item}/><b>{item.short}</b><span>{item.stock} disp.</span></button>)}</div>
      <section className="pp-pos-cart"><h3>Venda atual</h3>{Object.entries(cart).length ? Object.entries(cart).map(([short, qty]) => <p key={short}><span>{qty}x {short}</span><b>R$ {qty * 16},00</b></p>) : <p>Toque em um sabor para comecar.</p>}<div><WalletCards/><strong>{total} fatias · R$ {total * 16},00</strong></div><button>Fechar venda</button></section>
    </main>
  </section>;
}

function ManagerFlow() {
  return <section className="pp-dashboard">
    <header><BrandLockup/><button>Publicar card da semana</button></header>
    <section className="pp-dash-hero"><div><span>Hoje no festival</span><h1>Operacao pronta para vender sem improviso.</h1><p>Estoque, reservas, vendas e fidelidade na mesma visao.</p></div><SliceArt item={flavors[2]}/></section>
    <div className="pp-dash-grid">
      <article><b>R$ 384,00</b><span>faturamento</span></article><article><b>24</b><span>fatias vendidas</span></article><article><b>5</b><span>reservas online</span></article><article><b>2</b><span>prêmios pendentes</span></article>
    </div>
    <section className="pp-dash-board"><div><h2>Reservas para separar</h2>{['Juliana · 3 fatias · pago','Carlos · 2 fatias · retirada','Beth · 1 fatia · aguardando'].map(row => <p key={row}>{row}<ChevronRight/></p>)}</div><div><h2>Estoque por sabor</h2>{flavors.slice(0,5).map(item => <p key={item.short}><span>{item.short}</span><b>{item.stock} restantes</b></p>)}</div></section>
  </section>;
}

export function PremiumPreview() {
  const [tab, setTab] = useState<Tab>('Vitrine');
  return <main className="premium-preview"><PremiumTabs tab={tab} setTab={setTab}/>{tab === 'Vitrine' && <CustomerHome setTab={setTab}/>}{tab === 'Compra' && <PurchaseFlow setTab={setTab}/>}{tab === 'Pedido' && <OrderTracking/>}{tab === 'Clube' && <ClubFlow/>}{tab === 'Caixa' && <OperatorFlow/>}{tab === 'Gestor' && <ManagerFlow/>}</main>;
}
