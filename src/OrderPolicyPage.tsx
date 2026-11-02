import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  CalendarX,
  CakeSlice,
  Clock3,
  MapPin,
  MessageCircle,
  RefreshCcw,
} from "lucide-react";
import { orderWhatsAppUrl, useOrderWhatsAppNumber } from "./order-whatsapp";
import "./institutional-2026.css";

export default function OrderPolicyPage() {
  const orderWhatsAppNumber = useOrderWhatsAppNumber();
  const whatsapp = orderWhatsAppUrl(orderWhatsAppNumber, "Olá, Adoce! Li a política de pedidos e gostaria de consultar uma celebração ou produto.");
  return (
    <main className="institutional-2026">
      <section className="institutional-hero">
        <a className="institutional-back" href="/"><ArrowLeft /> Voltar à Adoce</a>
        <p className="institutional-kicker">Antes de fazer seu pedido</p>
        <h1>Política de pedidos</h1>
        <p>
          Nossa produção é artesanal e cada detalhe precisa de tempo e cuidado.
          Por isso, os produtos disponíveis para encomenda mudam conforme o dia
          da semana.
        </p>
        <a className="institutional-cta" href={whatsapp} target="_blank" rel="noreferrer">
          Consultar um pedido <MessageCircle />
        </a>
      </section>

      <div className="institutional-body">
        <section className="institutional-card">
          <h2>Reserva, confirmação, retirada e cancelamento</h2>
          <p><Clock3 style={{ display: "inline", width: 18, marginRight: 6 }} /><strong>Pré-reserva por 48 horas.</strong> A solicitação guarda sua preferência por até 48 horas. Quando houver concorrência no mesmo período, vale a primeira confirmação com sinal de 50%.</p>
          <p><MapPin style={{ display: "inline", width: 18, marginRight: 6 }} /><strong>Retirada e atendimento.</strong> Encomendas comuns são retiradas no Passaré. Serviços externos, deslocamento e local são confirmados no orçamento.</p>
          <p><RefreshCcw style={{ display: "inline", width: 18, marginRight: 6 }} /><strong>Cancelamentos.</strong> Com 7 dias úteis ou mais, devolução integral. De 3 a 6 dias úteis, devolução de 50% ou crédito integral. Com menos de 3 dias úteis, o valor permanece como crédito integral.</p>
        </section>

        <section className="institutional-card">
          <h2>O que podemos preparar em cada dia</h2>
          <p>Confira a regra correspondente ao dia do pedido. A disponibilidade final é confirmada pela equipe durante o atendimento.</p>
          <p><CalendarCheck style={{ display: "inline", width: 18, marginRight: 6 }} /><strong>Segunda a quarta-feira — Todos os produtos Adoce.</strong> São aceitos pedidos de todos os produtos da Cantinho da Adoce.</p>
          <p><CakeSlice style={{ display: "inline", width: 18, marginRight: 6 }} /><strong>Quinta a sábado — Tortas do Festival de Fatias.</strong> São aceitas somente tortas com sabores, modelos e tamanhos iguais aos disponíveis no Festival de Fatias. Consulte os sabores da semana.</p>
          <p><CalendarX style={{ display: "inline", width: 18, marginRight: 6 }} /><strong>Domingos — Sem encomendas.</strong> Não realizamos encomendas. O atendimento fica disponível apenas para delivery de fatias.</p>
        </section>

        <section className="institutional-card" style={{ textAlign: "center" }}>
          <h2>Seu momento especial começa com um pedido bem combinado.</h2>
          <a className="institutional-cta" href={whatsapp} target="_blank" rel="noreferrer">
            Falar com a Adoce <ArrowRight />
          </a>
        </section>
      </div>

    </main>
  );
}
