// Finalizar a reserva — o ultimo passo do Adoce Hoje.
//
// Dois campos e um botao. Nada de e-mail, CPF, endereco ou senha: a Adoce nao
// entrega, o cliente retira, e o resto ela nao precisa saber.
//
// **Nao cobra.** Reserva. O pagamento vem depois que a Adoce confirmar que
// separou — a regra que o Rubens repete desde o comeco.
//
// Cliente ja conhecido nao digita: a tela so confirma quem e.

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Gift } from "lucide-react";
import {
  horaAmigavel,
  mascaraTelefone,
  mensagemDaReserva,
  paraEnvio,
  podeReservar,
  resumoCurto,
  validar,
  type ClienteConhecido,
  type Reserva,
} from "./finalizar-reserva";
import { resumoDoPedido, totalDePresentes, type Item, type Sabor } from "./escolha-de-fatias";
import "./finalizar-reserva.css";

export default function FinalizarReserva({
  itens,
  sabores,
  horarios,
  local,
  conhecido,
  onVoltar,
  onConfirmar,
}: {
  itens: Item[];
  sabores: Sabor[];
  horarios: string[];
  local: string;
  conhecido?: ClienteConhecido | null;
  onVoltar?: () => void;
  onConfirmar: (dados: ReturnType<typeof paraEnvio>, mensagem: string) => Promise<void> | void;
}) {
  const [reserva, setReserva] = useState<Reserva>({
    nome: conhecido?.nome || "",
    telefone: conhecido?.telefone || "",
    horario: horarios[0] || "",
    observacao: "",
  });
  const [outraPessoa, setOutraPessoa] = useState(false);
  const [tentou, setTentou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const topo = useRef<HTMLDivElement>(null);

  useEffect(() => { window.scrollTo({ top: 0 }); }, []);

  const problemas = validar(reserva, horarios);
  const problemaDe = (campo: keyof Reserva) =>
    tentou ? problemas.find((p) => p.campo === campo)?.texto : undefined;

  const resumo = useMemo(() => resumoDoPedido(itens, sabores), [itens, sabores]);
  const presentes = totalDePresentes(itens);
  const identificado = Boolean(conhecido) && !outraPessoa;

  const confirmar = async () => {
    setTentou(true);
    setErro(null);
    if (!podeReservar(reserva, horarios)) return;
    setEnviando(true);
    try {
      await onConfirmar(
        paraEnvio(reserva, itens),
        mensagemDaReserva(reserva, itens, sabores, local),
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível reservar agora.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <main className="reserva" ref={topo}>
      {onVoltar ? (
        <button type="button" className="res-voltar" onClick={onVoltar}>
          <ArrowLeft aria-hidden="true" /> Escolher mais
        </button>
      ) : null}

      <h1 className="res-titulo">Sua reserva</h1>

      <section className="res-resumo" aria-label="O que você escolheu">
        <ul>
          {resumo.map((linha) => (
            <li key={linha.sabor}>
              <span className="res-qtd">{linha.quantidade}×</span>
              <span className="res-sabor">
                {linha.sabor}
                <small>{linha.caldas.map((c) => `${c.quantas > 1 ? `${c.quantas}× ` : ""}${c.nome.toLowerCase()}`).join(", ")}</small>
              </span>
              {linha.presentes ? (
                <span className="res-presente"><Gift aria-hidden="true" /> presente</span>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="res-total">{resumoCurto(itens, sabores)}</p>
        {presentes > 0 ? (
          <p className="res-presente-nota">
            {presentes === 1 ? "Uma fatia é presente do Clube" : `${presentes} fatias são presente do Clube`} — não entram no valor. 💗
          </p>
        ) : null}
      </section>

      {identificado ? (
        <section className="res-conhecido">
          <p><strong>{conhecido!.nome}</strong></p>
          <p className="res-telefone">{mascaraTelefone(conhecido!.telefone)}</p>
          <button type="button" onClick={() => { setOutraPessoa(true); setReserva((r) => ({ ...r, nome: "", telefone: "" })); }}>
            É para outra pessoa
          </button>
        </section>
      ) : (
        <>
          <label className="res-campo">
            <span>Seu nome e sobrenome</span>
            <input
              type="text"
              value={reserva.nome}
              onChange={(e) => setReserva((r) => ({ ...r, nome: e.target.value }))}
              autoComplete="name"
              autoCapitalize="words"
              enterKeyHint="next"
              aria-invalid={Boolean(problemaDe("nome"))}
            />
            {problemaDe("nome") ? <small role="alert">{problemaDe("nome")}</small> : null}
          </label>

          <label className="res-campo">
            <span>WhatsApp</span>
            <input
              type="tel"
              inputMode="numeric"
              value={mascaraTelefone(reserva.telefone)}
              onChange={(e) => setReserva((r) => ({ ...r, telefone: e.target.value }))}
              placeholder="(85) 99999-9999"
              autoComplete="tel"
              enterKeyHint="done"
              aria-invalid={Boolean(problemaDe("telefone"))}
            />
            {problemaDe("telefone") ? <small role="alert">{problemaDe("telefone")}</small> : null}
            <small className="res-ajuda">É por aqui que a gente avisa quando estiver separado.</small>
          </label>
        </>
      )}

      <fieldset className="res-horarios">
        <legend>Retirar às</legend>
        <div className="res-horas">
          {horarios.map((h) => (
            <button
              key={h}
              type="button"
              className={reserva.horario === h ? "escolhido" : ""}
              onClick={() => setReserva((r) => ({ ...r, horario: h }))}
            >
              {reserva.horario === h ? <Check aria-hidden="true" /> : null}
              {horaAmigavel(h)}
            </button>
          ))}
        </div>
        {problemaDe("horario") ? <small role="alert">{problemaDe("horario")}</small> : null}
        <p className="res-local">No {local}</p>
      </fieldset>

      <label className="res-campo">
        <span>Alguma observação? <em>(opcional)</em></span>
        <textarea
          rows={2}
          value={reserva.observacao}
          onChange={(e) => setReserva((r) => ({ ...r, observacao: e.target.value }))}
          maxLength={280}
        />
        {problemaDe("observacao") ? <small role="alert">{problemaDe("observacao")}</small> : null}
      </label>

      {erro ? <p className="res-erro" role="alert">{erro}</p> : null}

      <button type="button" className="res-confirmar" onClick={() => void confirmar()} disabled={enviando}>
        {enviando ? "Reservando…" : "Confirmar reserva"}
      </button>

      <p className="res-nota">
        A reserva não cobra nada agora. Assim que separarmos tudo, a gente avisa
        no seu WhatsApp — e só então você paga.
      </p>
    </main>
  );
}
