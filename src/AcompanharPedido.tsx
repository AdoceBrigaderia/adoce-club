// Acompanhar o pedido — a tela do cliente que espera.
//
// Em 08/08 a Juliana Vidal reservou as 10h52 e ficou sem saber se valia. O
// pedido estava certo no banco desde o primeiro segundo. Faltava ela poder ver.
//
// A tela responde tres perguntas, nessa ordem: onde esta, o que vem depois, e
// onde e quando retirar. Nada alem disso.
//
// **Nao cobra antes da hora.** O aviso de pagamento so aparece quando a Adoce
// ja confirmou que separou.

import { useEffect } from "react";
import { Check, Gift, Heart, MapPin, MessageCircle } from "lucide-react";
import {
  encerramento,
  estadoDoPasso,
  etapasVisiveis,
  faltaParaRetirada,
  vistaDoCliente,
} from "./acompanhar-pedido";
import { encerrado, type Pedido } from "./jornada-do-pedido";
import { fallbackOrderWhatsApp } from "./order-whatsapp";
import "./acompanhar-pedido.css";
import { formatarDataHora } from "./lib/datas";

const dinheiro = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(valor)
    .replace(/[\u00A0\u202F\u2007]/g, " ");

export type ClubProgress = {
  novoMembro: boolean;
  carimbosGanhos: number;
  progresso: number | null;
  meta: number;
};

const CartaoClube = ({ club, numeroPedido }: { club: ClubProgress; numeroPedido: string }) => {
  const faltam = club.progresso != null ? Math.max(club.meta - club.progresso, 0) : null;
  return (
    <section className="ac-clube">
      <div className="ac-clube-cabecalho">
        <div className="ac-clube-icone"><Heart aria-hidden="true" /></div>
        <span className="ac-clube-rotulo">{club.novoMembro ? "Bem-vinda(o) ao" : "Compra confirmada"}</span>
        <h3 className="ac-clube-titulo">{club.novoMembro ? "Clube Adoce" : "Obrigada pela sua fatia!"}</h3>
        <p className="ac-clube-sub">
          {club.novoMembro
            ? "Seu cadastro já foi feito automaticamente com este pedido — não precisa fazer mais nada."
            : club.carimbosGanhos > 0
              ? `Você ganhou +${club.carimbosGanhos} carimbo${club.carimbosGanhos > 1 ? "s" : ""} nesta compra.`
              : "Seu cadastro já está pronto."}
        </p>
      </div>

      {club.novoMembro ? (
        <div className="ac-clube-explicacao">
          <span>Como funciona</span>
          <p>A cada fatia confirmada, você ganha <strong>1 carimbo</strong>. Ao completar <strong>14 carimbos</strong>, a próxima fatia é por nossa conta — automático, sem precisar resgatar nada.</p>
        </div>
      ) : null}

      {club.progresso != null ? (
        <div className="ac-clube-cartao">
          <div className="ac-clube-cartao-topo"><span>Seu cartão</span><strong>{club.progresso} de {club.meta}</strong></div>
          <div className="ac-clube-pontos" aria-hidden="true">
            {Array.from({ length: club.meta }, (_, i) => {
              const preenchido = i < (club.progresso || 0);
              const ultimo = i === club.meta - 1;
              return (
                <span key={i} className={preenchido ? "cheio" : ultimo ? "premio" : ""}>
                  {preenchido ? <Check /> : ultimo ? <Gift /> : i + 1}
                </span>
              );
            })}
          </div>
          <p className="ac-clube-progresso">
            {faltam === 0
              ? "Sua próxima fatia é por nossa conta!"
              : `Faltam ${faltam} fatia${faltam === 1 ? "" : "s"} para sua fatia grátis.`}
          </p>
        </div>
      ) : null}

      {!club.novoMembro && club.carimbosGanhos > 0 ? (
        <p className="ac-clube-nota">
          Pedido {numeroPedido} · {club.carimbosGanhos} fatia{club.carimbosGanhos > 1 ? "s" : ""} confirmada{club.carimbosGanhos > 1 ? "s" : ""}. Os carimbos já foram lançados automaticamente no seu cartão.
        </p>
      ) : null}
    </section>
  );
};

export default function AcompanharPedido({
  pedido,
  retiradaEm,
  criadoEm,
  whatsapp = fallbackOrderWhatsApp,
  club = null,
}: {
  pedido: Pedido;
  /** Momento combinado da retirada, ISO. */
  retiradaEm?: string | null;
  /** Momento real em que a reserva foi registrada, ISO. */
  criadoEm?: string | null;
  whatsapp?: string;
  /** Progresso no Clube Adoce, só quando o pagamento já foi confirmado. */
  club?: ClubProgress | null;
}) {
  const vista = vistaDoCliente(pedido);
  const etapas = etapasVisiveis();
  const fim = encerramento(pedido.etapa);
  const contagem = faltaParaRetirada(retiradaEm || null);

  useEffect(() => { window.scrollTo({ top: 0 }); }, []);

  const falarNoZap = `https://wa.me/${whatsapp}?text=${encodeURIComponent(
    `Oi! Queria falar sobre a reserva ${pedido.numero}.`,
  )}`;

  return (
    <>
    <main className="acompanha">
      <header className="ac-topo">
        <p className="ac-numero">{pedido.numero}</p>
        <h1>{fim || vista.titulo}</h1>
        <p className="ac-agora">{vista.agora}</p>
        {criadoEm ? <p className="ac-data">Reserva recebida em {formatarDataHora(criadoEm)}</p> : null}
      </header>

      {!encerrado(pedido.etapa) ? (
        <ol className="ac-linha" aria-label="Andamento do pedido">
          {etapas.map((e) => {
            const estado = estadoDoPasso(e.passo, vista.passo);
            return (
              <li key={e.etapa} className={`ac-passo ac-${estado}`}>
                <span className="ac-bolinha" aria-hidden="true">
                  {estado === "feito" ? <Check /> : null}
                </span>
                <span className="ac-passo-nome">{e.nome}</span>
              </li>
            );
          })}
        </ol>
      ) : null}

      {vista.aSeguir ? <p className="ac-seguir">{vista.aSeguir}</p> : null}

      {vista.esperandoPagamento ? (
        <section className="ac-pagamento">
          <p>
            <strong>Está tudo separado para você.</strong> Agora sim pode pagar
            com tranquilidade — só pedimos o pagamento depois de garantir que
            está tudo guardado.
          </p>
        </section>
      ) : null}

      <section className="ac-itens" aria-label="O que você pediu">
        <h2>Seu pedido</h2>
        <ul>
          {pedido.itens.map((item, i) => (
            <li key={`${item.sabor}-${i}`}>
              <span className="ac-qtd">{item.quantidade}×</span>
              <span className="ac-sabor">
                {item.sabor}
                <small>{item.calda ? item.calda.toLowerCase() : "sem calda"}</small>
              </span>
              {item.presente ? (
                <span className="ac-presente"><Gift aria-hidden="true" /> presente</span>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="ac-total">{dinheiro(pedido.total)}</p>
      </section>

      {club ? <CartaoClube club={club} numeroPedido={pedido.numero} /> : null}

      {pedido.retirada && !encerrado(pedido.etapa) ? (
        <section className="ac-retirada">
          <MapPin aria-hidden="true" />
          <div>
            <p className="ac-local">{pedido.retirada.local}</p>
            <p className="ac-hora">A partir das {pedido.retirada.aPartirDe}</p>
            {contagem ? <p className="ac-contagem">{contagem}</p> : null}
          </div>
        </section>
      ) : null}

      <a className="ac-falar" href={falarNoZap} target="_blank" rel="noreferrer">
        <MessageCircle aria-hidden="true" /> Falar com a Adoce
      </a>

      <p className="ac-nota">
        Esta página se atualiza sozinha. Pode guardar o link — é só seu.
      </p>
    </main>
    </>
  );
}
