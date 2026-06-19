import { useMemo, useState } from 'react';
import { BadgeCheck, Bell, CakeSlice, Check, ChevronRight, Clock3, CreditCard, Gift, Heart, MapPin, Minus, Plus, QrCode, Search, ShoppingBag, Sparkles, Truck, Users, WalletCards } from 'lucide-react';
import { createCloudSale, saveProductCloud } from './lib/betaApi';
import { allPayments, noQrPayments, Payment, Product, Sale, SaleItem, useStore } from './store';
import './styles/premium-preview.css';

type Tab = 'Vitrine' | 'Compra' | 'Pedido' | 'Clube' | 'Caixa' | 'Gestor';
type Cart = Record<string, number>;

const originalLogo = '/assets/branding/logo-adoce-original.jpeg';
const fallbackSlice = '/assets/stamps/stamp-fatia-chocolate-v2.png';

const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const cleanKey = (value: string) => value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ');
const productShort = (product: Product, fallback?: string) => product.shortName || fallback || product.name.split(/\s+/)[0] || 'Fatia';

function PremiumTabs({ tab, setTab }: { tab: Tab; setTab: (tab: Tab) => void }) {
  const tabs: Tab[] = ['Vitrine', 'Compra', 'Pedido', 'Clube', 'Caixa', 'Gestor'];
  return <nav className="pp-tabs" aria-label="Ambiente premium">{tabs.map(item => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item}</button>)}</nav>;
}

function PremiumLogo({ compact = false }: { compact?: boolean }) {
  return <span className={`pp-logo ${compact ? 'compact' : ''}`}><img src={originalLogo} alt="Adoce Brigaderia"/><i/><b/></span>;
}

function BrandLockup() {
  return <div className="pp-brand"><PremiumLogo compact/><div><b>Adoce Club</b><span>Festival de fatias</span></div></div>;
}

function SlicePhoto({ imageUrl, compact = false }: { imageUrl?: string; compact?: boolean }) {
  return <span className={`pp-slice-photo ${compact ? 'compact' : ''}`}><img src={imageUrl || fallbackSlice} alt="Fatia de torta"/><i/></span>;
}

function useProducts() {
  const store = useStore();
  const todayPlan = store.plannedProductions.find(p => p.date === new Date().toISOString().slice(0, 10)) || store.plannedProductions.find(p => p.date >= new Date().toISOString().slice(0, 10)) || store.plannedProductions[0];
  const source = store.cashOpen ? store.cashFlavors : todayPlan?.flavors.length ? todayPlan.flavors : store.cashFlavors;
  return source.map(flavor => {
    const product = (store.productCatalog ?? []).find(p => cleanKey(p.name) === cleanKey(flavor.name));
    return {
      name: flavor.name,
      shortName: productShort(product || ({ name: flavor.name, shortName: flavor.shortName } as Product), flavor.shortName),
      quantity: flavor.quantity,
      imageUrl: product?.imageUrl || flavor.imageUrl,
    };
  });
}

function CustomerHome({ setTab }: { setTab: (tab: Tab) => void }) {
  const s = useStore();
  const products = useProducts();
  return <section className="pp-phone pp-home">
    <header className="pp-top">
      <BrandLockup/>
      <button onClick={() => setTab('Pedido')} aria-label="Notificações"><Bell/><i>{s.reservations.length || 1}</i></button>
    </header>
    <div className="pp-location"><MapPin/><span>Boa noite, {s.customer.name || 'cliente'}</span><b>{s.company.placeName}</b></div>
    <button className="pp-coupon" onClick={() => setTab('Clube')}><Gift/> Você ganhou carimbos beta <ChevronRight/></button>
    <nav className="pp-categories">
      <button onClick={() => setTab('Compra')}><CakeSlice/><span>Sabores</span></button>
      <button onClick={() => setTab('Compra')}><Sparkles/><span>Promos</span></button>
      <button onClick={() => setTab('Clube')}><BadgeCheck/><span>Prêmios</span></button>
      <button onClick={() => window.open(s.company.wazeUrl || s.company.mapsUrl, '_blank')}><MapPin/><span>Rota</span></button>
    </nav>
    <section className="pp-hero">
      <div>
        <span>Hoje às 19h</span>
        <h1>Escolha suas fatias antes da fila.</h1>
        <p>Monte a cestinha, acompanhe a separação e receba seus carimbos.</p>
        <button onClick={() => setTab('Compra')}>Montar minha cestinha</button>
      </div>
      <SlicePhoto imageUrl={products[0]?.imageUrl}/>
    </section>
    <section className="pp-loyalty">
      <div><Heart/> <b>{s.stamps} de {s.settings.stampGoal} carimbos</b><button onClick={() => setTab('Clube')}>Ver clube</button></div>
      <span><i style={{ width: `${Math.min(100, (s.stamps / s.settings.stampGoal) * 100)}%` }}/></span>
    </section>
    <div className="pp-section-title"><h2>Sabores de hoje</h2><button onClick={() => setTab('Compra')}>Ver todos</button></div>
    <div className="pp-product-row">{products.slice(0, 6).map(item => <article key={item.name} className="pp-product"><SlicePhoto imageUrl={item.imageUrl} compact/><b>{item.shortName}</b><span>{item.quantity} disp.</span></article>)}</div>
    <footer className="pp-nav"><button onClick={() => setTab('Vitrine')}>Início</button><button onClick={() => setTab('Compra')}>Cardápio</button><button onClick={() => setTab('Compra')}>Cestinha</button><button onClick={() => setTab('Clube')}>Clube</button></footer>
  </section>;
}

function PurchaseFlow({ setTab }: { setTab: (tab: Tab) => void }) {
  const s = useStore();
  const products = useProducts();
  const [cart, setCart] = useState<Cart>({});
  const [payment, setPayment] = useState<Payment>('Mercado Pago Link');
  const total = useMemo(() => Object.values(cart).reduce((a, b) => a + b, 0), [cart]);
  const amount = total * s.settings.price;
  const change = (name: string, delta: number) => setCart(current => ({ ...current, [name]: Math.max(0, (current[name] || 0) + delta) }));
  const selected = products.filter(item => cart[item.name] > 0);
  const close = () => {
    if (!total) return;
    const today = new Date().toISOString().slice(0, 10);
    const items = selected.map(item => ({ flavor: item.name, quantity: cart[item.name] }));
    const payNow = payment === 'Mercado Pago Link';
    s.addReservation({
      customer: s.customer.name || 'Cliente beta',
      quantity: total,
      flavor: items.map(item => item.flavor).join(' + '),
      items,
      date: today,
      deliveryType: 'Delivery / Retirada',
      status: payNow ? 'waiting_payment' : 'requested',
      paymentMethod: payment,
      payNow,
      paymentLinkUrl: payNow ? `https://mpago.la/mock-reserva-${Date.now()}` : undefined,
      notes: payNow ? 'Pagamento antecipado escolhido no premium beta.' : 'Pagamento na retirada escolhido no premium beta.',
    });
    setTab('Pedido');
  };
  return <section className="pp-phone pp-cart">
    <header className="pp-top compact"><BrandLockup/><ShoppingBag/></header>
    <div className="pp-search"><Search/> Buscar sabor ou promoção</div>
    <div className="pp-flavor-grid">{products.map(item => <button key={item.name} onClick={() => change(item.name, 1)}><SlicePhoto imageUrl={item.imageUrl} compact/><b>{item.shortName}</b><span>{item.quantity} fatias</span><em>{cart[item.name] ? `${cart[item.name]} na cesta` : 'adicionar'}</em></button>)}</div>
    <section className="pp-basket">
      <h2>Cestinha</h2>
      {selected.length ? selected.map(item => <div className="pp-basket-row" key={item.name}>
        <SlicePhoto imageUrl={item.imageUrl} compact/><div><b>{item.name}</b><span>Calda será escolhida após pagamento online.</span></div>
        <button onClick={() => change(item.name, -1)} aria-label={`Diminuir ${item.name}`}><Minus/></button><strong>{cart[item.name]}</strong><button onClick={() => change(item.name, 1)} aria-label={`Aumentar ${item.name}`}><Plus/></button>
      </div>) : <p>Toque em um sabor para adicionar.</p>}
      <div className="pp-payment-choice">{(['Mercado Pago Link', 'Pix', 'Cartão', 'Dinheiro'] as Payment[]).map(p => <button key={p} className={payment === p ? 'active' : ''} onClick={() => setPayment(p)}><CreditCard/>{p}</button>)}</div>
      <div className="pp-total"><span>{total} fatias</span><b>{money(amount)}</b></div>
      <button className="pp-primary" disabled={!total} onClick={close}>Fechar compra</button>
    </section>
  </section>;
}

function OrderTracking() {
  const s = useStore();
  const lastReservation = s.reservations[0];
  const steps = ['Pedido recebido', 'Separando fatias', 'Aguardando pagamento', 'Pronto para retirada'];
  return <section className="pp-phone pp-track">
    <header className="pp-top compact"><BrandLockup/><Clock3/></header>
    <section className="pp-order-hero"><QrCode/><span>{lastReservation ? `Reserva ${lastReservation.id}` : 'Pedido beta'}</span><h1>Estamos separando suas fatias.</h1><p>Quando estiver pronto, você recebe o aviso para buscar na barraquinha.</p></section>
    <div className="pp-timeline">{steps.map((step, index) => <div key={step} className={index < 2 ? 'done' : index === 2 ? 'active' : ''}><i>{index < 2 ? <Check/> : index + 1}</i><span>{step}</span><small>{index === 1 ? 'agora' : index === 2 ? 'próximo passo' : 'ok'}</small></div>)}</div>
    <section className="pp-order-card"><h2>Itens reservados</h2>{lastReservation?.items?.length ? lastReservation.items.map(item => <p key={item.flavor}>{item.quantity}x {item.flavor}{item.syrup ? ` · ${item.syrup}` : ''}</p>) : <><p>2x Chocolatudo</p><p>1x Ferrero Rocher</p></>}<button className="pp-primary" onClick={() => window.open(`https://wa.me/${s.company.whatsapp.replace(/\D/g, '')}`, '_blank')}>Falar no WhatsApp</button></section>
  </section>;
}

function ClubFlow() {
  const s = useStore();
  return <section className="pp-phone pp-club">
    <header className="pp-top compact"><BrandLockup/><Gift/></header>
    <section className="pp-club-hero"><BadgeCheck/><h1>Seu clube de vantagens</h1><p>Faltam {Math.max(0, s.settings.stampGoal - s.stamps)} carimbos para sua fatia premiada.</p></section>
    <div className="pp-stamp-grid">{Array.from({ length: s.settings.stampGoal }).map((_, index) => <span key={index} className={index < s.stamps ? 'filled' : ''}>{index < s.stamps ? <SlicePhoto compact/> : index + 1}</span>)}</div>
    <section className="pp-rewards"><h2>Prêmios e selos</h2>{s.rewards.length ? s.rewards.map(reward => <div key={reward.id}><Gift/><b>{reward.type}</b><span>{reward.status}</span></div>) : <div><Gift/><b>Fatia premiada</b><span>Complete sua cartela para liberar.</span></div>}<div><Users/><b>Família doce</b><span>Compartilhe carimbos</span></div></section>
  </section>;
}

function OperatorFlow() {
  const s = useStore();
  const products = useProducts();
  const [cart, setCart] = useState<Cart>({});
  const [payment, setPayment] = useState<Payment>('Pix');
  const [sale, setSale] = useState<Sale | null>(null);
  const [saving, setSaving] = useState(false);
  const [cloudError, setCloudError] = useState('');
  const total = Object.values(cart).reduce((a, b) => a + b, 0);
  const amount = total * s.settings.price;
  const change = (name: string, delta: number) => setCart(current => ({ ...current, [name]: Math.max(0, (current[name] || 0) + delta) }));
  const selected = products.filter(item => cart[item.name] > 0);
  const submit = async (kind: 'Presencial' | 'Delivery / Retirada') => {
    if (!total) return;
    setSaving(true);
    setCloudError('');
    const items: SaleItem[] = selected.map(item => ({ flavor: item.name, quantity: cart[item.name] }));
    const localSale = s.addSale({ qty: total, items, payment, kind, notes: noQrPayments.includes(payment) ? 'Operação registrada no premium beta' : undefined });
    setSale(localSale);
    if (localSale.generatesStamps) {
      try {
        const cloud = await createCloudSale(localSale);
        s.replaceSaleToken(localSale.id, cloud.token);
        setSale({ ...localSale, token: cloud.token });
      } catch (error) {
        setCloudError(error instanceof Error ? error.message : 'Venda local registrada, mas sem sincronizar na nuvem.');
      }
    }
    setCart({});
    setSaving(false);
  };
  return <section className="pp-tablet">
    <aside><PremiumLogo/><h1>{s.cashOpen ? 'Caixa aberto' : 'Caixa beta'}</h1><p>{s.users.find(u => u.id === s.currentUserId)?.name || 'Rubens'} · Festival de fatias</p><div><b>Reservas online</b><span>{s.reservations.filter(r => !['picked_up', 'cancelled'].includes(r.status)).length} para separar</span></div><div><b>Fatias restantes</b><span>{s.available} no estoque</span></div></aside>
    <main><header><div><span>Venda rápida</span><h2>Toque nos sabores da compra</h2></div><button onClick={() => alert('Reservas ficam na aba Gestor enquanto o premium beta é conectado ao fluxo completo.')}><Truck/> Reservas</button></header>
      <div className="pp-pos-grid">{products.map(item => <button key={item.name} onClick={() => change(item.name, 1)}><SlicePhoto imageUrl={item.imageUrl}/><b>{item.shortName}</b><span>{item.quantity} disp.</span></button>)}</div>
      <section className="pp-pos-cart"><h3>Venda atual</h3>{selected.length ? selected.map(item => <div className="pp-pos-row" key={item.name}><SlicePhoto imageUrl={item.imageUrl} compact/><span>{item.name}</span><button onClick={() => change(item.name, -1)}><Minus/></button><strong>{cart[item.name]}</strong><button onClick={() => change(item.name, 1)}><Plus/></button><b>{money(cart[item.name] * s.settings.price)}</b></div>) : <p>Toque em um sabor para começar.</p>}<div className="pp-payment-choice">{allPayments.map(p => <button key={p} className={payment === p ? 'active' : ''} onClick={() => setPayment(p)}><WalletCards/>{p}</button>)}</div><div><WalletCards/><strong>{total} fatias · {noQrPayments.includes(payment) ? 'Sem receita' : money(amount)}</strong></div>{sale && <small className="pp-ok">Venda {sale.id} registrada{sale.generatesStamps ? ' com QR de fidelidade' : ''}.</small>}{cloudError && <small className="pp-warn">{cloudError}</small>}<button disabled={!total || saving} onClick={() => submit('Presencial')}>{saving ? 'Registrando...' : 'Fechar venda'}</button></section>
    </main>
  </section>;
}

function ProductEditor({ product }: { product: Product }) {
  const saveProduct = useStore(s => s.saveProduct);
  const [draft, setDraft] = useState(product);
  const [status, setStatus] = useState('');
  const save = async () => {
    saveProduct(draft);
    setStatus('Salvo neste aparelho.');
    try {
      await saveProductCloud(draft);
      setStatus('Salvo no banco.');
    } catch {
      setStatus('Salvo localmente. Entre como equipe para salvar na nuvem.');
    }
  };
  return <article className="pp-product-edit"><SlicePhoto imageUrl={draft.imageUrl} compact/><label>Nome completo<input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}/></label><label>Nome do botão<input value={draft.shortName} onChange={e => setDraft({ ...draft, shortName: e.target.value })}/></label><button onClick={save}>Salvar</button>{status && <small>{status}</small>}</article>;
}

function ManagerFlow() {
  const s = useStore();
  const syncProductsFromCards = useStore(state => state.syncProductsFromCards);
  const [syncStatus, setSyncStatus] = useState('');
  const products = (s.productCatalog ?? []).filter(p => p.active);
  const syncCatalog = async () => {
    syncProductsFromCards();
    setSyncStatus('Sincronizando neste aparelho...');
    setTimeout(async () => {
      try {
        const currentProducts = (useStore.getState().productCatalog ?? []).filter(p => p.active);
        await Promise.all(currentProducts.map(product => saveProductCloud(product)));
        setSyncStatus(`${currentProducts.length} produto(s) sincronizados no banco.`);
      } catch {
        setSyncStatus('Catálogo local atualizado. Entre como equipe para sincronizar no banco.');
      }
    }, 0);
  };
  return <section className="pp-dashboard">
    <header><BrandLockup/><button onClick={syncCatalog}>Sincronizar cards</button></header>
    <section className="pp-dash-hero"><div><span>Hoje no festival</span><h1>Operação pronta para vender sem improviso.</h1><p>Catálogo único, estoque, reservas, vendas e fidelidade na mesma visão.</p></div><SlicePhoto imageUrl={products[0]?.imageUrl}/></section>
    <div className="pp-dash-grid">
      <article><b>{money(s.sales.reduce((a, sale) => a + sale.grossAmount, 0))}</b><span>faturamento</span></article><article><b>{s.sales.reduce((a, sale) => a + sale.qty, 0)}</b><span>fatias vendidas</span></article><article><b>{s.reservations.length}</b><span>reservas online</span></article><article><b>{products.length}</b><span>produtos</span></article>
    </div>
    <section className="pp-products-admin"><h2>Cadastro de produtos</h2><p>O sistema cria o sabor se ele vier no card e ainda não existir. Aqui você edita o nome abreviado usado no caixa.</p>{syncStatus && <small className="pp-ok">{syncStatus}</small>}{products.map(product => <ProductEditor key={product.id} product={product}/>)}</section>
  </section>;
}

export function PremiumPreview() {
  const [tab, setTab] = useState<Tab>('Vitrine');
  return <main className="premium-preview"><PremiumTabs tab={tab} setTab={setTab}/>{tab === 'Vitrine' && <CustomerHome setTab={setTab}/>}{tab === 'Compra' && <PurchaseFlow setTab={setTab}/>}{tab === 'Pedido' && <OrderTracking/>}{tab === 'Clube' && <ClubFlow/>}{tab === 'Caixa' && <OperatorFlow/>}{tab === 'Gestor' && <ManagerFlow/>}</main>;
}
