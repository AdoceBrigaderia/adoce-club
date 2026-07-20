import { ArrowLeft, ArrowRight, CakeSlice, Check, MessageCircle, Users } from "lucide-react";
import PublicHeader from "./PublicHeader";
import "./public-site.css";
import "./public-commercial-polish.css";

const whatsapp = "https://wa.me/5585982156026?text=Ol%C3%A1%2C%20Adoce!%20Quero%20organizar%20uma%20compra%20em%20grupo.";

export default function GroupOrderPage() {
  return (
    <main className="public-site group-order-page">
      <PublicHeader />
      <section className="group-order-hero">
        <div>
          <a className="public-back on-dark" href="/#inicio"><ArrowLeft /> Voltar à Adoce</a>
          <p className="public-kicker">Compra em Grupo</p>
          <h1>Mais fatias.<br /><em>Mais gente feliz.</em></h1>
          <p>Reúna cinco fatias ou mais em um único pedido para o mesmo endereço em Fortaleza.</p>
          <a className="public-primary" href={whatsapp} target="_blank" rel="noreferrer">Organizar no WhatsApp <ArrowRight /></a>
        </div>
        <figure className="group-order-proof">
          <img src="/site/compra-em-grupo-real.jpeg" alt="Vários pedidos Adoce separados para uma compra realizada em grupo" />
          <figcaption>Pedido real preparado em grupo pela Adoce.</figcaption>
        </figure>
      </section>
      <section className="group-order-rules">
        <article><Users /><h2>Monte o grupo</h2><p>Amigos, família, condomínio ou equipe de trabalho escolhem juntos.</p></article>
        <article><CakeSlice /><h2>Escolha as fatias</h2><p>Envie sabores e quantidades. A equipe confirma disponibilidade e valor.</p></article>
        <article><Check /><h2>Um só pedido</h2><p>Pagamento antecipado por Pix ou link de cartão e entrega no mesmo endereço.</p></article>
      </section>
      <section className="group-order-final">
        <MessageCircle />
        <h2>Vamos organizar seu grupo?</h2>
        <p>A conversa já abre com a mensagem pronta para a equipe Adoce.</p>
        <a className="public-primary" href={whatsapp} target="_blank" rel="noreferrer">Falar com a Adoce <ArrowRight /></a>
      </section>
    </main>
  );
}
