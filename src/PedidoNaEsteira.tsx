// O pedido na esteira, na tela da operacao.
//
// Um cartao por pedido, com a linha do tempo em cima e um botao so embaixo: o
// proximo passo. Sem menu, sem lista de status para escolher, sem chance de
// pular etapa por engano.
//
// Cada avanco abre a mensagem pronta no WhatsApp do cliente. E de proposito
// que sejam a mesma acao: se avancar e avisar forem dois botoes, um dia alguem
// avanca e nao avisa â€” e ai nasce a proxima Juliana.

import { useState } from "react";
import { Check, Copy, Gift, MessageCircle } from "lucide-react";
import {
  ESTEIRA,
  JORNADA,
  encerrado,
  linkDeWhatsApp,
  mensagemParaCliente,
  pendencia,
  podeCobrar,
  proximaEtapa,
  rotuloDoAvanco,
  type Etapa,
  type Pedido,
} from "./jornada-do-pedido";
import "./pedido-na-esteira.css";

const dinheiro = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

export default function PedidoNaEsteira({
  pedido,
  criadoEm,
  onAvancar,
}: {
  pedido: Pedido;
  criadoEm: string;
  /** Recebe a etapa de destino. A gravacao no banco fica por conta de quem chama. */
  onAvancar?: (proxima: NonNullable<ReturnType<typeof proximaEtapa>>) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [copiado, setCopiado] = useState<Etapa | null>(null);

  // Copia primeiro, abre depois. O link wa.me abre a conversa com o texto
  // pronto, mas NAO envia â€” e no WhatsApp Business e no computador as vezes o
  // texto nem aparece. Com o texto na area de transferencia, sempre da para
  // colar. Foi parte do que falhou com a Juliana Sousa em 07/08.
  const avisar = async (etapa: Etapa, abrirConversa = true) => {
    const texto = mensagemParaCliente({ ...pedido, etapa });
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(etapa);
      window.setTimeout(() => setCopiado(null), 2500);
    } catch {
      // Sem area de transferencia seguimos assim mesmo: a previa abaixo mostra
      // o texto inteiro para copiar na mao.
    }
    if (abrirConversa) {
      window.open(linkDeWhatsApp({ ...pedido, etapa }), "_blank", "noopener");
    }
  };

  const definicao = JORNADA[pedido.etapa];
  const proxima = proximaEtapa(pedido);
  const rotulo = rotuloDoAvanco(pedido);
  const atraso = pendencia(pedido, Date.now(), new Date(criadoEm).getTime());
  const passoAtual = definicao.passo ?? 0;

  return (
    <article className={`pe-cartao${atraso ? ` pe-${atraso.gravidade}` : ""}`}>
      <header className="pe-topo">
        <div>
          <h3 className="pe-cliente">{pedido.cliente}</h3>
          <p className="pe-numero">{pedido.numero}</p>
        </div>
        <p className="pe-total">{dinheiro(pedido.total)}</p>
      </header>

      {encerrado(pedido.etapa) ? (
        <p className="pe-final">{definicao.operacao}</p>
      ) : (
        <ol className="pe-linha" aria-label="Etapas do pedido">
          {ESTEIRA.filter((etapa) => etapa !== "completed").map((etapa) => {
            const passo = JORNADA[etapa].passo ?? 0;
            const estado = passo < passoAtual ? "feito" : passo === passoAtual ? "agora" : "futuro";
            return (
              <li key={etapa} className={`pe-passo pe-passo-${estado}`}>
                <span className="pe-bolinha" aria-hidden="true">
                  {estado === "feito" ? <Check /> : null}
                </span>
                <span className="pe-passo-nome">{JORNADA[etapa].cliente}</span>
              </li>
            );
          })}
        </ol>
      )}

      <ul className="pe-itens">
        {pedido.itens.map((item, indice) => (
          <li key={`${item.sabor}-${indice}`}>
            <strong>{item.quantidade}Ã—</strong> {item.sabor}
            {item.calda ? ` Â· ${item.calda.toLowerCase()}` : " Â· sem calda"}
            {item.presente ? (
              <span className="pe-presente">
                <Gift aria-hidden="true" /> presente
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      {pedido.retirada ? (
        <p className="pe-retirada">
          Retira a partir das {pedido.retirada.aPartirDe} Â· {pedido.retirada.local}
        </p>
      ) : null}

      {atraso ? <p className="pe-atraso">{atraso.texto}</p> : null}

      {podeCobrar(pedido) ? (
        <p className="pe-cobranca">
          JÃ¡ pode pedir o pagamento â€” o pedido estÃ¡ separado.
        </p>
      ) : null}

      <div className="pe-acoes">
        {proxima && rotulo && onAvancar ? (
          <button type="button" className="pe-avancar" onClick={() => onAvancar(proxima)}>
            {rotulo}
          </button>
        ) : null}

        <button
          type="button"
          className="pe-whatsapp"
          onClick={() => void avisar(pedido.etapa)}
        >
          {copiado === pedido.etapa ? <Check aria-hidden="true" /> : <MessageCircle aria-hidden="true" />}
          {copiado === pedido.etapa ? "Copiado â€” abrindo o zap" : "Copiar e abrir o WhatsApp"}
        </button>
      </div>

      <details className="pe-previa" open={aberto} onToggle={(e) => setAberto(e.currentTarget.open)}>
        <summary>Outras mensagens deste pedido</summary>

        <pre>{mensagemParaCliente(pedido)}</pre>

        {/* Todas as etapas ficam a mao: as vezes e preciso reenviar a
            confirmacao, ou avisar que ja pode retirar sem ter avancado ainda. */}
        <div className="pe-atalhos">
          {ESTEIRA.filter((etapa) => etapa !== pedido.etapa).map((etapa) => (
            <button
              key={etapa}
              type="button"
              onClick={() => void avisar(etapa, false)}
            >
              {copiado === etapa ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copiado === etapa ? "Copiado" : JORNADA[etapa].cliente}
            </button>
          ))}
        </div>
      </details>
    </article>
  );
}

