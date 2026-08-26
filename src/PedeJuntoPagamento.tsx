// Pede Junto — a tela onde cada um paga a sua.
//
// A tela existe para tirar o dinheiro das costas do organizador. Ele monta o
// grupo, a Adoce confirma que separou, e **cada pessoa recebe o proprio link**.
// O organizador acompanha; nao cobra ninguem.
//
// O minichat fica aqui embaixo porque a combinacao acontece de qualquer jeito —
// hoje ela acontece num grupo de WhatsApp onde a Adoce nao esta, e por isso a
// gente perde o pedido quando alguem some. Trazendo a conversa para o pedido,
// a duvida ("cabe mais uma?", "que horas busca?") tem resposta no mesmo lugar
// onde ela vira venda.

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Clock, MessageCircle, Send } from "lucide-react";
import {
  dinheiro,
  faltamPagar,
  jaPagaram,
  lembreteDePagamento,
  linkDeWhatsAppDoGrupo,
  podeCobrar,
  resumoParaOrganizador,
  situacaoDoParticipante,
  todosPagaram,
  totalDoGrupo,
  totalRecebido,
  type GrupoDePagamento,
  type ParticipanteDoPagamento,
} from "./pede-junto-pagamento";
import "./pede-junto-pagamento.css";

export type Recado = {
  id: string;
  autor: string;
  texto: string;
  daAdoce: boolean;
  criadoEm: string;
};

export default function PedeJuntoPagamento({
  grupo,
  eu,
  souOrganizador = false,
  recados = [],
  onEnviarRecado,
  onPagar,
}: {
  grupo: GrupoDePagamento;
  eu: ParticipanteDoPagamento | null;
  souOrganizador?: boolean;
  recados?: Recado[];
  onEnviarRecado?: (texto: string) => void;
  onPagar?: (participante: ParticipanteDoPagamento) => void;
}) {
  const pagaram = jaPagaram(grupo);
  const faltam = faltamPagar(grupo);
  const liberado = podeCobrar(grupo);
  const fechou = todosPagaram(grupo);

  return (
    <main className="pj">
      <nav className="pj-barra" aria-label="Navegação">
        <a className="pj-voltar" href="#inicio">
          <ArrowLeft aria-hidden="true" /> Início
        </a>
        <a className="pj-atalho" href="#adoce-hoje">O que tem hoje</a>
      </nav>

      <header className="pj-capa">
        <p className="pj-legenda">Pede Junto</p>
        <h1>{grupo.nome}</h1>
        <p className="pj-resumo">{resumoParaOrganizador(grupo)}</p>
        {grupo.entregaGratis ? (
          <p className="pj-selo">Entrega grátis liberada 💗</p>
        ) : null}
      </header>

      {/* O que EU tenho que fazer, antes de qualquer outra coisa na tela. */}
      {eu ? (
        <section className={`pj-minha-vez${eu.estado === "pago" ? " ok" : ""}`}>
          <p className="pj-minha-linha">
            <span>{eu.fatias} {eu.fatias === 1 ? "fatia" : "fatias"}</span>
            <strong>{dinheiro(eu.valor)}</strong>
          </p>
          <p className="pj-situacao">{situacaoDoParticipante(eu, grupo)}</p>

          {liberado && eu.estado !== "pago" && eu.linkDePagamento ? (
            <a
              className="pj-pagar"
              href={eu.linkDePagamento}
              onClick={() => onPagar?.(eu)}
              target="_blank"
              rel="noreferrer"
            >
              Pagar minha parte · {dinheiro(eu.valor)}
            </a>
          ) : null}

          {eu.estado === "pago" ? (
            <p className="pj-pago"><Check aria-hidden="true" /> Tudo certo por aqui</p>
          ) : null}
        </section>
      ) : null}

      {/* Quem já acertou. O organizador vê quem pagou — nunca com quê. */}
      <section className="pj-gente">
        <h2>Quem está no grupo</h2>
        <ul className="pj-lista">
          {grupo.participantes.map((p) => (
            <li key={p.id} className={p.estado === "pago" ? "pj-ok" : ""}>
              <span className="pj-nome">{p.nome}</span>
              <span className="pj-fatias">
                {p.fatias} {p.fatias === 1 ? "fatia" : "fatias"}
              </span>
              <span className="pj-marca" aria-label={p.estado === "pago" ? "pagou" : "ainda não pagou"}>
                {p.estado === "pago" ? <Check aria-hidden="true" /> : <Clock aria-hidden="true" />}
              </span>
            </li>
          ))}
        </ul>

        {liberado ? (
          <p className="pj-conta">
            {pagaram.length} de {grupo.participantes.length} pagaram ·{" "}
            {dinheiro(totalRecebido(grupo))} de {dinheiro(totalDoGrupo(grupo))}
          </p>
        ) : null}
      </section>

      {/* O organizador não cobra: ele só reencaminha o aviso, se quiser. */}
      {souOrganizador && faltam.length > 0 && liberado ? (
        <section className="pj-organizador">
          <p>
            Cada um já recebeu o próprio link. Se quiser dar um toque no grupo,
            a mensagem está pronta:
          </p>
          <a
            className="pj-lembrar"
            href={linkDeWhatsAppDoGrupo(lembreteDePagamento(grupo))}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle aria-hidden="true" /> Mandar no grupo
          </a>
        </section>
      ) : null}

      {fechou ? (
        <section className="pj-fechado">
          <p>Todo mundo acertou. É só buscar no horário combinado. 💗</p>
        </section>
      ) : null}

      <MiniChat recados={recados} onEnviar={onEnviarRecado} />

      <nav className="pj-rodape" aria-label="Para onde ir agora">
        <a className="pj-principal" href="#sabores">Ver todos os sabores</a>
        <a className="pj-secundario" href="#inicio">Voltar ao início</a>
      </nav>
    </main>
  );
}

/**
 * O minichat do pedido. Curto de proposito: e recado, nao conversa longa.
 * A Adoce aparece marcada, porque a duvida que trava o grupo quase sempre e
 * para ela — e hoje ela nao esta na conversa.
 */
function MiniChat({
  recados,
  onEnviar,
}: {
  recados: Recado[];
  onEnviar?: (texto: string) => void;
}) {
  const [texto, setTexto] = useState("");
  const fim = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "nearest" });
  }, [recados.length]);

  const enviar = () => {
    const limpo = texto.trim();
    if (!limpo || !onEnviar) return;
    onEnviar(limpo);
    setTexto("");
  };

  return (
    <section className="pj-chat">
      <h2>Recados do grupo</h2>

      {recados.length === 0 ? (
        <p className="pj-vazio">
          Ainda sem recados. Dúvida sobre sabor, horário ou quem falta? Pergunte
          aqui — a Adoce também lê.
        </p>
      ) : (
        <ul className="pj-recados">
          {recados.map((r) => (
            <li key={r.id} className={r.daAdoce ? "pj-adoce" : ""}>
              <span className="pj-autor">{r.daAdoce ? "Adoce" : r.autor}</span>
              <p>{r.texto}</p>
            </li>
          ))}
          <div ref={fim} />
        </ul>
      )}

      {onEnviar ? (
        <form
          className="pj-escrever"
          onSubmit={(e) => { e.preventDefault(); enviar(); }}
        >
          <label className="pj-oculto" htmlFor="pj-recado">Escrever um recado</label>
          <input
            id="pj-recado"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escrever um recado…"
            maxLength={280}
            autoComplete="off"
          />
          <button type="submit" disabled={!texto.trim()} aria-label="Enviar recado">
            <Send aria-hidden="true" />
          </button>
        </form>
      ) : null}
    </section>
  );
}
