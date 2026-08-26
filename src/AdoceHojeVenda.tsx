// Adoce Hoje — onde a venda acontece.
//
// A regra visual: **a foto manda.** Cada sabor ocupa quase meia tela. Antes era
// uma linha de texto com um botao do lado — cardapio de refeitorio. O que vende
// bolo e a foto do bolo.
//
// A regra de uso: **um toque escolhe a fatia, um toque escolhe a calda, e
// acabou.** A calda so aparece depois que a fatia entra, e ate ela ser
// escolhida o pedido nao fecha.
//
// Nada de dado que a Adoce nao precisa saber. O nome e o WhatsApp entram no
// final, e so isso.

import { useMemo, useState } from "react";
import { Check, Gift, Minus, Plus } from "lucide-react";
import {
  SEM_CALDA,
  adicionar,
  avisoDeEstoque,
  dinheiro,
  escolherCalda,
  oQueFalta,
  podeAdicionar,
  podeFinalizar,
  remover,
  restamDoSabor,
  total,
  totalDeFatias,
  totalDePresentes,
  usarPresente,
  type Calda,
  type Item,
  type Sabor,
} from "./escolha-de-fatias";
import "./adoce-hoje-venda.css";

export default function AdoceHojeVenda({
  sabores,
  caldas,
  dataPorExtenso,
  retiradaAPartirDe,
  presentesDisponiveis = 0,
  onFinalizar,
}: {
  sabores: Sabor[];
  caldas: Calda[];
  dataPorExtenso: string;
  retiradaAPartirDe: string;
  presentesDisponiveis?: number;
  onFinalizar?: (itens: Item[]) => void;
}) {
  const [itens, setItens] = useState<Item[]>([]);

  const disponiveis = useMemo(() => sabores.filter((s) => s.disponiveis > 0), [sabores]);
  const fatias = totalDeFatias(itens);
  const valor = total(itens, sabores);
  const pendencia = oQueFalta(itens);

  const opcoes = [...caldas.map((c) => c.nome), SEM_CALDA];

  return (
    <main className="hoje">
      <header className="hoje-capa">
        <p className="hoje-data">{dataPorExtenso}</p>
        <h1>
          {disponiveis.length === 1 ? "Um sabor saiu" : `${disponiveis.length} sabores saíram`}
          <em> do forno hoje.</em>
        </h1>
        <p className="hoje-faixa">
          <span className="hoje-ponto" aria-hidden="true" />
          Reservas abertas · retirada a partir das {retiradaAPartirDe}
        </p>
      </header>

      <ul className="hoje-lista">
        {disponiveis.map((sabor) => {
          const item = itens.find((i) => i.saborId === sabor.id);
          const quantas = item?.caldas.length || 0;
          const restam = restamDoSabor(itens, sabor);
          const acabando = sabor.disponiveis <= 3;

          return (
            <li key={sabor.id} className="hoje-sabor">
              <div className="hoje-foto">
                {sabor.fotoUrl ? (
                  <img src={sabor.fotoUrl} alt={sabor.nome} loading="lazy" />
                ) : (
                  <div className="hoje-sem-foto" aria-hidden="true" />
                )}
                <span className={`hoje-estoque${acabando ? " acabando" : ""}`}>
                  {avisoDeEstoque(sabor)}
                </span>
                <div className="hoje-nome">
                  <h2>{sabor.nome}</h2>
                  {sabor.premium ? <span className="hoje-premium">fatia premium</span> : null}
                </div>
              </div>

              <div className="hoje-linha">
                <p className="hoje-preco">
                  <strong>{dinheiro(sabor.preco)}</strong>
                  <small>a fatia</small>
                </p>

                {quantas === 0 ? (
                  <button
                    type="button"
                    className="hoje-quero"
                    onClick={() => setItens(adicionar(itens, sabor))}
                  >
                    Quero essa
                  </button>
                ) : (
                  <div className="hoje-contador">
                    <button type="button" onClick={() => setItens(remover(itens, sabor.id))} aria-label={`Tirar uma fatia de ${sabor.nome}`}>
                      <Minus aria-hidden="true" />
                    </button>
                    <strong>{quantas}</strong>
                    <button
                      type="button"
                      onClick={() => setItens(adicionar(itens, sabor))}
                      disabled={!podeAdicionar(itens, sabor)}
                      aria-label={`Mais uma fatia de ${sabor.nome}`}
                    >
                      <Plus aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>

              {/* A calda so aparece depois que a fatia entra. Antes disso seria
                  uma pergunta sem motivo. */}
              {item ? (
                <div className="hoje-caldas">
                  {item.caldas.map((escolhida, posicao) => (
                    <div key={posicao} className="hoje-calda-linha">
                      <span className="hoje-calda-rotulo">
                        {item.caldas.length > 1 ? `${posicao + 1}ª fatia` : "Calda"}
                      </span>
                      <div className="hoje-calda-opcoes">
                        {opcoes.map((nome) => (
                          <button
                            key={nome}
                            type="button"
                            className={escolhida === nome ? "escolhida" : ""}
                            onClick={() => setItens(escolherCalda(itens, sabor.id, posicao, nome))}
                          >
                            {escolhida === nome ? <Check aria-hidden="true" /> : null}
                            {nome}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  {presentesDisponiveis > totalDePresentes(itens) ? (
                    <button
                      type="button"
                      className="hoje-presente"
                      onClick={() => setItens(usarPresente(itens, sabor.id, presentesDisponiveis))}
                    >
                      <Gift aria-hidden="true" /> Usar minha fatia-presente aqui
                    </button>
                  ) : null}

                  {item.presentes > 0 ? (
                    <p className="hoje-presente-marcado">
                      <Gift aria-hidden="true" />
                      {item.presentes === 1 ? "Uma fatia é presente 💗" : `${item.presentes} fatias são presente 💗`}
                    </p>
                  ) : null}

                  {restam === 0 ? <p className="hoje-ultima">Era a última.</p> : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {fatias > 0 ? (
        <div className="hoje-rodape">
          <div className="hoje-conta">
            <strong>{dinheiro(valor)}</strong>
            <small>{fatias} {fatias === 1 ? "fatia" : "fatias"}</small>
          </div>
          <button
            type="button"
            className="hoje-fechar"
            onClick={() => onFinalizar?.(itens)}
            disabled={!podeFinalizar(itens)}
          >
            {pendencia ? "Escolha a calda" : "Reservar"}
          </button>
          {pendencia ? <p className="hoje-pendencia">{pendencia}</p> : null}
        </div>
      ) : null}

      {!disponiveis.length ? (
        <p className="hoje-vazio">
          Hoje já vendemos tudo. Amanhã tem mais, feito na hora. 💗
        </p>
      ) : null}
    </main>
  );
}
