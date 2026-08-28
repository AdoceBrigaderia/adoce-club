// Compartilhe Docura — o cartao de indicacoes.
//
// Doze posicoes, decisao do Rubens. Cada amigo que prova pela primeira vez vira
// um coracao.
//
// O convite principal e uma mensagem **sem link**: o amigo diz o codigo no
// balcao. Boa parte dos clientes so tem WhatsApp e Instagram gratuitos no
// plano, e pedir para abrir link constrange quem esta sem dado.
//
// Existem 85 codigos no banco esperando esta tela desde sempre.

import { useEffect, useState } from "react";
import { CakeSlice, Check, Copy, Heart, Share2 } from "lucide-react";
import {
  INCLINACAO,
  POSICOES,
  aguardando,
  carimbosNaCartela,
  confirmadas,
  convitePorMensagem,
  legendaDaIndicacao,
  linkDeWhatsApp,
  progresso,
  type CartaoDeIndicacao,
} from "./compartilhe-docura";
import "./compartilhe-docura.css";

export default function CompartilheDocura({ cartao }: { cartao: CartaoDeIndicacao }) {
  const [copiado, setCopiado] = useState(false);
  const carimbos = carimbosNaCartela(cartao);
  const jaProvaram = confirmadas(cartao);
  const convidados = aguardando(cartao);

  useEffect(() => {
    if (!copiado) return;
    const t = window.setTimeout(() => setCopiado(false), 2500);
    return () => window.clearTimeout(t);
  }, [copiado]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(convitePorMensagem(cartao));
      setCopiado(true);
    } catch {
      // Sem area de transferencia o texto continua visivel abaixo.
    }
  };

  return (
    <main className="docura">
      <header className="doc-topo">
        <p className="doc-legenda">Cartão de indicações</p>
        <h1>Compartilhe Doçura</h1>
        <p className="doc-progresso">{progresso(cartao)}</p>
      </header>

      <ul className="doc-cartela" aria-label={`${carimbos} de ${POSICOES} indicações`}>
        {Array.from({ length: POSICOES }, (_, i) => {
          const feito = i < carimbos;
          return (
            <li key={i} className={`doc-marca ${feito ? "feita" : "vazia"}`}>
              {feito ? (
                <>
                  <Heart style={{ transform: `rotate(${INCLINACAO[i]}deg)` }} aria-hidden="true" />
                  <span className="sr-only">Indicação {i + 1} confirmada</span>
                </>
              ) : (
                <>
                  <CakeSlice aria-hidden="true" />
                  <span className="sr-only">Posição {i + 1} ainda livre</span>
                </>
              )}
            </li>
          );
        })}
      </ul>

      <section className="doc-convite">
        <h2>Seu código</h2>
        <p className="doc-codigo">{cartao.codigo}</p>
        <p className="doc-explica">
          Ao compartilhar, o link cai direto no nosso WhatsApp com o seu código
          já escrito. Seu amigo não precisa abrir site nem instalar nada — e se
          preferir, é só dizer o código no balcão.
        </p>

        <div className="doc-acoes">
          <a className="doc-enviar" href={linkDeWhatsApp(cartao)} target="_blank" rel="noreferrer">
            <Share2 aria-hidden="true" /> Convidar pelo WhatsApp
          </a>
          <button type="button" className="doc-copiar" onClick={() => void copiar()}>
            {copiado ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copiado ? "Copiado" : "Copiar convite"}
          </button>
        </div>

        <details className="doc-previa">
          <summary>Ver a mensagem</summary>
          <pre>{convitePorMensagem(cartao)}</pre>
        </details>
      </section>

      {jaProvaram.length ? (
        <section className="doc-lista">
          <h2>Quem já provou</h2>
          <ul>
            {jaProvaram.map((i) => (
              <li key={i.nome}>
                <Heart aria-hidden="true" />
                <span>{i.nome}</span>
                <small>{legendaDaIndicacao(i)}</small>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {convidados.length ? (
        <section className="doc-lista doc-esperando">
          <h2>Convidados</h2>
          <ul>
            {convidados.map((i) => (
              <li key={i.nome}>
                <CakeSlice aria-hidden="true" />
                <span>{i.nome}</span>
                <small>{legendaDaIndicacao(i)}</small>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
