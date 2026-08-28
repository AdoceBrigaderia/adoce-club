// A agenda de encomendas.
//
// Uma tela para responder ao cliente sem abrir tres outras e contar na cabeca.
// Cada dia mostra o que ainda cabe; ao escolher um dia, a tela ja diz se
// confirma na hora, se precisa de avaliacao ou se nao da — e, quando nao da,
// oferece a data mais proxima que da.
//
// Isso existe por causa da Gabriela: ela pediu 100 docinhos, quis mudar o
// horario, e a operacao nao tinha onde ver se cabia.
//
// Recusar sem oferecer alternativa e venda perdida de graca. Por isso a tela
// nunca termina em "nao".

import { useMemo, useState } from "react";
import { CalendarDays, Check, Copy, School, TriangleAlert } from "lucide-react";
import {
  avaliarEncomenda,
  docinhosDisponiveis,
  proximaDataPossivel,
  respostaAoCliente,
  tortasDisponiveis,
  type Agenda,
} from "./capacidade-de-encomenda";
import "./agenda-de-encomendas.css";

const DIA_MS = 86_400_000;

const DIA_CURTO = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const porExtenso = (data: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(data);

export default function AgendaDeEncomendas({
  agendaDe,
  hoje = new Date(),
  dias = 21,
}: {
  /** Devolve a ocupacao de um dia. Quem chama busca no banco. */
  agendaDe: (data: Date) => Agenda;
  hoje?: Date;
  dias?: number;
}) {
  const [tortas, setTortas] = useState(1);
  const [docinhos, setDocinhos] = useState(0);
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const pedido = { tortas, docinhos };

  const calendario = useMemo(() => {
    const inicio = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate());
    return Array.from({ length: dias }, (_, i) => {
      const data = new Date(inicio + i * DIA_MS);
      const agenda = agendaDe(data);
      return {
        data,
        chave: data.toISOString().slice(0, 10),
        agenda,
        tortasLivres: tortasDisponiveis(data, agenda),
        docinhosLivres: docinhosDisponiveis(agenda),
        veredito: avaliarEncomenda(pedido, data, agenda, hoje),
      };
    });
  }, [agendaDe, hoje, dias, tortas, docinhos]);

  const selecionado = calendario.find((d) => d.chave === escolhido) || null;

  const alternativa = useMemo(() => {
    if (!selecionado || selecionado.veredito.cabe) return null;
    return proximaDataPossivel(pedido, selecionado.data, agendaDe, hoje);
  }, [selecionado, agendaDe, hoje, tortas, docinhos]);

  const resposta = selecionado
    ? respostaAoCliente(
        selecionado.veredito,
        alternativa ? porExtenso(alternativa) : undefined,
      )
    : "";

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(resposta);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      // A resposta continua visivel acima para copiar na mao.
    }
  };

  return (
    <main className="agenda-enc">
      <header className="ae-topo">
        <p className="ae-legenda">Encomendas</p>
        <h1>O que cabe em cada dia</h1>
      </header>

      <section className="ae-pedido" aria-label="O que o cliente quer">
        <label>
          Tortas
          <input
            type="number"
            min={0}
            max={20}
            inputMode="numeric"
            value={tortas}
            onChange={(e) => setTortas(Math.max(0, Number(e.target.value) || 0))}
          />
        </label>
        <label>
          Docinhos
          <input
            type="number"
            min={0}
            max={2000}
            step={10}
            inputMode="numeric"
            value={docinhos}
            onChange={(e) => setDocinhos(Math.max(0, Number(e.target.value) || 0))}
          />
        </label>
      </section>

      <ul className="ae-calendario" aria-label="Próximos dias">
        {calendario.map((dia) => {
          const estado = !dia.veredito.cabe
            ? "fechado"
            : dia.veredito.exigeAvaliacao
              ? "avaliar"
              : "livre";
          return (
            <li key={dia.chave}>
              <button
                type="button"
                className={`ae-dia ae-dia-${estado}${escolhido === dia.chave ? " ae-dia-escolhido" : ""}`}
                onClick={() => setEscolhido(dia.chave)}
                aria-pressed={escolhido === dia.chave}
              >
                <span className="ae-dia-semana">{DIA_CURTO[dia.data.getUTCDay()]}</span>
                <span className="ae-dia-numero">{dia.data.getUTCDate()}</span>
                {dia.agenda.escolaReservada ? (
                  <School className="ae-dia-marca" aria-label="Adoce na Escola" />
                ) : (
                  <span className="ae-dia-vagas">
                    {dia.tortasLivres > 0 ? `${dia.tortasLivres} torta${dia.tortasLivres === 1 ? "" : "s"}` : "cheio"}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {selecionado ? (
        <section className={`ae-veredito ae-veredito-${selecionado.veredito.cabe ? (selecionado.veredito.exigeAvaliacao ? "avaliar" : "livre") : "fechado"}`}>
          <h2>
            {selecionado.veredito.cabe
              ? selecionado.veredito.exigeAvaliacao
                ? <><TriangleAlert aria-hidden="true" /> Cabe, mas confira antes</>
                : <><Check aria-hidden="true" /> Pode confirmar</>
              : <><CalendarDays aria-hidden="true" /> Não cabe nesse dia</>}
          </h2>

          <p className="ae-veredito-data">{porExtenso(selecionado.data)}</p>

          {selecionado.veredito.motivos.length ? (
            <ul className="ae-motivos">
              {selecionado.veredito.motivos.map((motivo) => (
                <li key={motivo}>{motivo}</li>
              ))}
            </ul>
          ) : null}

          {selecionado.veredito.cabe ? (
            <p className="ae-restam">
              Depois deste pedido ainda cabem{" "}
              <strong>{selecionado.veredito.restam.tortas}</strong>{" "}
              {selecionado.veredito.restam.tortas === 1 ? "torta" : "tortas"} e{" "}
              <strong>{selecionado.veredito.restam.docinhos}</strong> docinhos.
            </p>
          ) : alternativa ? (
            <p className="ae-alternativa">
              Data mais próxima que dá: <strong>{porExtenso(alternativa)}</strong>
            </p>
          ) : null}

          <div className="ae-resposta">
            <p>{resposta}</p>
            <button type="button" onClick={() => void copiar()}>
              {copiado ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copiado ? "Copiado" : "Copiar resposta"}
            </button>
          </div>
        </section>
      ) : (
        <p className="ae-dica">Escolha um dia para ver se cabe.</p>
      )}
    </main>
  );
}
