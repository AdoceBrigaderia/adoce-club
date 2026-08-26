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
import { Check, Gift, MapPin, MessageCircle } from "lucide-react";
import {
  encerramento,
  estadoDoPasso,
  etapasVisiveis,
  faltaParaRetirada,
  vistaDoCliente,
} from "./acompanhar-pedido";
import { encerrado, type Pedido } from "./jornada-do-pedido";
import "./acompanhar-pedido.css";
import { formatarDataHora } from "./lib/datas";

const dinheiro = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(valor)
    .replace(/[\u00A0\u202F\u2007]/g, " ");

export default function AcompanharPedido({
  pedido,
  retiradaEm,
  criadoEm,
  whatsapp = "5585982156026",
}: {
  pedido: Pedido;
  /** Momento combinado da retirada, ISO. */
  retiradaEm?: string | null;
  /** Momento real em que a reserva foi registrada, ISO. */
  criadoEm?: string | null;
  whatsapp?: string;
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
  );
}
