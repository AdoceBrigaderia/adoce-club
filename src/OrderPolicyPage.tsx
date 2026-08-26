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
import "./public-site.css";
import "./order-policy.css";

export default function OrderPolicyPage() {
  const orderWhatsAppNumber = useOrderWhatsAppNumber();
  const whatsapp = orderWhatsAppUrl(orderWhatsAppNumber, "Olá, Adoce! Li a política de pedidos e gostaria de consultar uma celebração ou produto.");
  return (
    <main className="public-site order-policy-page">

      <section className="order-policy-hero">
        <div className="order-policy-intro">
          <a className="public-back" href="/#inicio">
            <ArrowLeft /> Voltar à Adoce
          </a>
          <p className="public-kicker">Antes de fazer seu pedido</p>
          <h1>Política de<br />{" "}<em>pedidos.</em></h1>
          <p>
            Nossa produção é artesanal e cada detalhe precisa de tempo e cuidado.
            Por isso, os produtos disponíveis para encomenda mudam conforme o dia
            da semana.
          </p>
          <a className="public-primary" href={whatsapp} target="_blank" rel="noreferrer">
            Consultar um pedido <MessageCircle />
          </a>
        </div>

        <figure className="order-policy-artwork">
          <img
            src="/site/politica-de-pedidos.jpeg"
            alt="Arte oficial da política de pedidos da Adoce Brigaderia"
          />
          <figcaption>Política oficial de pedidos da Adoce Brigaderia.</figcaption>
        </figure>
      </section>

      <section className="order-policy-process" aria-labelledby="order-policy-process-title">
        <header>
          <p className="public-kicker">Funcionamento completo</p>
          <h2 id="order-policy-process-title">Reserva, confirmação, retirada e cancelamento.</h2>
        </header>
        <div>
          <article><Clock3 /><span><strong>Pré-reserva por 48 horas</strong><p>A solicitação guarda sua preferência por até 48 horas. Quando houver concorrência no mesmo período, vale a primeira confirmação com sinal de 50%.</p></span></article>
          <article><MapPin /><span><strong>Retirada e atendimento</strong><p>Encomendas comuns são retiradas no Passaré. Serviços externos, deslocamento e local são confirmados no orçamento.</p></span></article>
          <article><RefreshCcw /><span><strong>Cancelamentos</strong><p>Com 7 dias úteis ou mais, devolução integral. De 3 a 6 dias úteis, devolução de 50% ou crédito integral. Com menos de 3 dias úteis, o valor permanece como crédito integral.</p></span></article>
        </div>
      </section>

      <section className="order-policy-rules" aria-labelledby="order-policy-title">
        <div className="order-policy-heading">
          <div>
            <p className="public-kicker">Organize sua encomenda</p>
            <h2 id="order-policy-title">O que podemos preparar em cada dia.</h2>
          </div>
          <p>
            Confira a regra correspondente ao dia do pedido. A disponibilidade
            final é confirmada pela equipe durante o atendimento.
          </p>
        </div>

        <div className="order-policy-list">
          <article>
            <CalendarCheck />
            <div>
              <span>Segunda a quarta-feira</span>
              <h3>Todos os produtos Adoce</h3>
              <p>São aceitos pedidos de todos os produtos da Adoce Brigaderia.</p>
            </div>
          </article>
          <article>
            <CakeSlice />
            <div>
              <span>Quinta a sábado</span>
              <h3>Tortas do Festival de Fatias</h3>
              <p>
                São aceitas somente tortas com sabores, modelos e tamanhos iguais
                aos disponíveis no Festival de Fatias. Consulte os sabores da semana.
              </p>
            </div>
          </article>
          <article>
            <CalendarX />
            <div>
              <span>Domingos</span>
              <h3>Sem encomendas</h3>
              <p>Não realizamos encomendas. O atendimento fica disponível apenas para delivery de fatias.</p>
            </div>
          </article>
        </div>
      </section>

      <section className="order-policy-final">
        <div>
          <p className="public-kicker">Conte sempre com a gente</p>
          <h2>Seu momento especial começa com um pedido bem combinado.</h2>
        </div>
        <a className="public-primary" href={whatsapp} target="_blank" rel="noreferrer">
          Falar com a Adoce <ArrowRight />
        </a>
      </section>

      <footer className="public-footer">
        <a className="public-brand" href="/#inicio">
          <img src="/site/logo.webp" alt="" />
          <strong>Adoce Brigaderia</strong>
        </a>
        <p>Transformando momentos especiais em doces memórias.</p>
        <div>
          <a href="/#politica-de-pedidos">Política de pedidos</a>
          <a href="/#privacidade">Privacidade</a>
        </div>
      </footer>
    </main>
  );
}
