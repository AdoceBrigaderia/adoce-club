import { MessageCircle } from "lucide-react";
import { orderWhatsAppUrl, useOrderWhatsAppNumber } from "./order-whatsapp";
import "./catalog-2026.css";
import "./catalog-2026-overrides.css";

const base = "/brand-2026/catalogo";
const sizes = [
  { label: "P", dimensions: "15 × 15 cm", price: "R$ 120,00", description: "Ideal para encontros menores e momentos especiais.", photo: "torta-P-recortada.png" },
  { label: "M", dimensions: "15 × 20 cm", price: "R$ 160,00", description: "Perfeita para compartilhar com a família e amigos.", photo: "torta-M-recortada.png" },
  { label: "G", dimensions: "12 × 25 cm", price: "R$ 200,00", description: "Para ocasiões especiais e para quem não abre mão de uma boa fatia.", photo: "torta-G-recortada.png" },
] as const;
const sweets = [
  { title: "Tradicionais", price: "R$ 70,00", photo: `${base}/docinhos/tradicional.png`, items: ["Brigadeiro", "Beijinho", "Casadinho", "Chocoball", "Ninho", "Amendoim", "Nesquik"] },
  { title: "Especiais", price: "R$ 90,00", photo: `${base}/docinhos/especial.png`, items: ["Churros", "Ninho com Nutella", "Surpresa de Uva", "Confeito M&M's", "Ferrero Rocher"] },
] as const;
const steps = [
  ["Escolha seus produtos", "Selecione os sabores das tortas ou dos docinhos e informe as quantidades desejadas.", "bolo.svg"],
  ["Defina o tamanho", "Para tortas, escolha entre P, M ou G.", "seta-direita.svg"],
  ["Informe a data", "Nossa equipe verificará a disponibilidade de produção e retirada.", "calendario.svg"],
  ["Confirme seu pedido", "Para reservar, é necessário o pagamento antecipado de 50% do valor total.", "cartao.svg"],
] as const;

export default function CatalogPage2026() {
  const whatsappNumber = useOrderWhatsAppNumber();
  const whatsapp = orderWhatsAppUrl(whatsappNumber, "Olá, Adoce! Vi o catálogo e gostaria de fazer uma encomenda.");
  return <main className="catalog-new">
    <section className="catalog-new-hero"><div><h1>Encomendas<br />Adoce <span>♡</span></h1><p>Conheça tamanhos, valores e condições para fazer sua encomenda.</p></div></section>
    <section className="catalog-panel">
      <div className="catalog-section-title"><img src={`${base}/icones/bolo.svg`} alt="" /><div><h2>Tortas artesanais <span>♡</span></h2><p>Nossas tortas são feitas artesanalmente, com ingredientes selecionados e muito carinho em cada camada.</p></div></div>
      <div className="catalog-size-grid">{sizes.map(size => <article key={size.label}><div className="catalog-cake-photo"><img src={`${base}/fotos-recortadas/${size.photo}`} alt={`Torta tamanho ${size.label}`} /><strong>{size.label}</strong></div><div className="catalog-size-meta"><b>{size.dimensions}</b><strong>{size.price}</strong></div><p>{size.description}</p></article>)}</div>
      <a className="catalog-wide-link" href="/sabores"><img src={`${base}/icones/bolo.svg`} alt="" />Clique aqui para conferir todos os sabores disponíveis para as tortas <span>→</span></a>
    </section>
    <section className="catalog-panel">
      <div className="catalog-section-title"><img src={`${base}/icones/brigadeiro.svg`} alt="" /><div><h2>Nossos docinhos <span>♡</span></h2><p>Docinhos artesanais para aniversários, confraternizações, celebrações e eventos.</p></div></div>
      <div className="catalog-sweets-grid">{sweets.map(sweet => <article key={sweet.title}><div><h3>{sweet.title}</h3><ul>{sweet.items.map(item => <li key={item}>{item}</li>)}</ul></div><img src={sweet.photo} alt={`Docinhos ${sweet.title.toLowerCase()}`} /><div className="catalog-sweet-price"><strong>{sweet.price}</strong><span>/ 50 un.</span><small>Peso unit. 15g</small></div></article>)}</div>
      <p className="catalog-sweets-rule"><img src={`${base}/icones/presente.svg`} alt="" /><strong>Pedidos de docinhos:</strong> A cada 50 unidades, você pode escolher até dois sabores da mesma categoria, com 25 unidades de cada.</p>
      <a className="catalog-wide-link catalog-sweets-link" href="/docinhos"><img src={`${base}/icones/brigadeiro.svg`} alt="" />Clique aqui para ver algumas fotos de docinhos <span>→</span></a>
    </section>
    <section className="catalog-panel">
      <div className="catalog-section-title"><img src={`${base}/icones/presente.svg`} alt="" /><div><h2>Como fazer sua encomenda <span>♡</span></h2></div></div>
      <div className="catalog-steps">{steps.map(([title,text,icon],i)=><article key={title}><b>{i+1}</b><img src={`${base}/icones/${icon}`} alt="" /><p><strong>{title}</strong><br />{text}</p></article>)}</div>
      <div className="catalog-info"><article><img src={`${base}/icones/casa.svg`} alt="" /><p><strong>Retirada e transporte</strong><br />Encomendas disponíveis para retirada no Cantinho da Adoce.<br /><b>O transporte é de total responsabilidade do cliente, não realizamos entrega de produtos.</b></p></article><article><img src={`${base}/icones/cartao.svg`} alt="" /><p><strong>Formas de pagamento</strong><br />Aceitamos Pix, dinheiro, cartão de débito e cartão de crédito.</p></article><article><img src={`${base}/icones/arquivo.svg`} alt="" /><p><strong>Alterações e cancelamentos</strong><br />Condições informadas na confirmação do pedido, conforme prazos aplicáveis.</p></article></div>
      <a className="catalog-whatsapp" href={whatsapp} target="_blank" rel="noreferrer"><MessageCircle /> Falar no WhatsApp <span>→</span></a>
    </section>
  </main>;
}
