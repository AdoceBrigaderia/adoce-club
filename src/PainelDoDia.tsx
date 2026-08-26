// O painel do dia da operacao.
//
// Uma tela para a manha inteira. Desenhada para o celular, de pe, com uma mao
// so — porque e assim que a operacao acontece de verdade.
//
// A ordem da tela e a ordem das perguntas:
//   1. O que precisa de mim agora  (as acoes, no topo, impossiveis de ignorar)
//   2. Quanto ainda tenho para vender  (os sabores, o que esta acabando primeiro)
//   3. O que ja aconteceu  (os pedidos de hoje)
//
// As outras quarenta telas de operacao continuam existindo. Elas so deixam de
// ser a porta de entrada.

import { useMemo } from "react";
import {
  AlertTriangle,
  CakeSlice,
  ChevronRight,
  Info,
  RefreshCw,
} from "lucide-react";
import {
  acoesDoDia,
  aLiberar,
  dinheiro,
  disponivel,
  frasedoDia,
  resumoDoDia,
  saboresOrdenados,
  type Acao,
  type EstadoDoDia,
} from "./painel-do-dia";
import "./painel-do-dia.css";

const ICONE: Record<Acao["gravidade"], typeof Info> = {
  critico: AlertTriangle,
  atencao: AlertTriangle,
  informativo: Info,
};

const horaCurta = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Fortaleza",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

export default function PainelDoDia({
  estado,
  onAcao,
  onAtualizar,
  carregando = false,
}: {
  estado: EstadoDoDia;
  /** Recebe a chave da acao: liberar-producao, pedidos-novos, dia-vazio... */
  onAcao?: (chave: string) => void;
  onAtualizar?: () => void;
  carregando?: boolean;
}) {
  const resumo = useMemo(() => resumoDoDia(estado), [estado]);
  const acoes = useMemo(() => acoesDoDia(estado), [estado]);
  const sabores = useMemo(() => saboresOrdenados(estado.sabores), [estado.sabores]);
  const pedidos = useMemo(
    () => estado.pedidos.filter((p) => p.status !== "cancelado"),
    [estado.pedidos],
  );

  return (
    <main className="painel-dia" aria-busy={carregando}>
      <header className="pd-topo">
        <div>
          <p className="pd-legenda">Operação Adoce · hoje</p>
          <h1 className="pd-frase">{frasedoDia(estado)}</h1>
        </div>
        {onAtualizar ? (
          <button
            type="button"
            className="pd-atualizar"
            onClick={onAtualizar}
            aria-label="Atualizar o painel"
          >
            <RefreshCw aria-hidden="true" />
          </button>
        ) : null}
      </header>

      {acoes.length ? (
        <section className="pd-acoes" aria-label="Precisa da sua ação">
          {acoes.map((acao) => {
            const Icone = ICONE[acao.gravidade];
            return (
              <article key={acao.chave} className={`pd-acao pd-acao-${acao.gravidade}`}>
                <Icone className="pd-acao-icone" aria-hidden="true" />
                <div className="pd-acao-texto">
                  <h2>{acao.titulo}</h2>
                  <p>{acao.detalhe}</p>
                </div>
                {acao.botao && onAcao ? (
                  <button type="button" onClick={() => onAcao(acao.chave)}>
                    {acao.botao}
                    <ChevronRight aria-hidden="true" />
                  </button>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : (
        <p className="pd-tranquilo">Nada esperando por você agora. 💗</p>
      )}

      <section className="pd-numeros" aria-label="Resumo do dia">
        <p>
          <strong>{resumo.totalDisponivel}</strong>
          <span>disponíveis</span>
        </p>
        <p>
          <strong>{resumo.totalVendido}</strong>
          <span>vendidas</span>
        </p>
        <p>
          <strong>{resumo.pedidos}</strong>
          <span>{resumo.pedidos === 1 ? "pedido" : "pedidos"}</span>
        </p>
        <p>
          <strong>{dinheiro(resumo.receita)}</strong>
          <span>hoje</span>
        </p>
      </section>

      <section className="pd-sabores" aria-label="Sabores de hoje">
        <h2 className="pd-secao">Sabores</h2>
        {sabores.length ? (
          <ul>
            {sabores.map((sabor) => {
              const restante = disponivel(sabor);
              const espera = aLiberar(sabor);
              const estadoSabor = restante === 0
                ? espera > 0 ? "esperando" : "esgotado"
                : restante <= 3 ? "acabando" : "ok";
              return (
                <li key={sabor.flavorId} className={`pd-sabor pd-sabor-${estadoSabor}`}>
                  <CakeSlice aria-hidden="true" />
                  <span className="pd-sabor-nome">{sabor.nome}</span>
                  <span className="pd-sabor-conta">
                    {restante > 0 ? (
                      <><strong>{restante}</strong> de {sabor.liberado}</>
                    ) : espera > 0 ? (
                      <em>{espera} para liberar</em>
                    ) : (
                      <em>esgotado</em>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="pd-vazio">Nenhum sabor cadastrado para hoje.</p>
        )}
      </section>

      <section className="pd-pedidos" aria-label="Pedidos de hoje">
        <h2 className="pd-secao">Pedidos</h2>
        {pedidos.length ? (
          <ul>
            {pedidos.map((p) => (
              <li key={p.id} className={`pd-pedido pd-pedido-${p.status}`}>
                <div>
                  <p className="pd-pedido-cliente">{p.cliente}</p>
                  <p className="pd-pedido-detalhe">
                    {p.fatias} {p.fatias === 1 ? "fatia" : "fatias"} · {dinheiro(p.total)} ·{" "}
                    Pedido em {horaCurta(p.criadoEm)}
                    {p.retiradaEm ? ` · retirada ${horaCurta(p.retiradaEm)}` : ""}
                  </p>
                </div>
                <span className="pd-pedido-status">
                  {p.status === "novo"
                    ? "sem resposta"
                    : p.status === "separado"
                      ? "separado"
                      : p.status === "pago"
                        ? "pago"
                        : "retirado"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pd-vazio">Nenhum pedido até agora.</p>
        )}
      </section>
    </main>
  );
}
