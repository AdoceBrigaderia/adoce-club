// Area do cliente — as duas cartelas do Clube Adoce.
//
// O cartao de papel tinha 14 coracoes que a Beth carimbava com um carimbo em
// forma de fatia. O cliente perdia, molhava, e tinha que recomecar. Foi por
// isso que este projeto existe.
//
// Aqui a cartela comeca cheia de fatias e cada compra transforma uma em
// coracao. A 14a posicao guarda o presente. O segundo cartao, Compartilhe
// Docura, tem 12 posicoes e ganha um coracao a cada amigo que prova pela
// primeira vez.

import { useEffect, useState } from "react";
import { CakeSlice, Gift, Heart } from "lucide-react";
import { loadConnectedClubSummary } from "./ConnectedClubSummary";
import "./adoce-clube.css";

const TOTAL_CLUBE = 14;
const TOTAL_INDICACAO = 12;

// Carimbo de mao nunca sai reto duas vezes igual.
const INCLINACAO = [-11, 7, -4, 13, -8, 5, -15, 10, -3, 12, -6, 9, -13, 4];

type Estado = {
  primeiroNome: string;
  codigo: string;
  clube: number;
  indicacoes: number;
  presentes: number;
};

function Cartela({
  titulo,
  legenda,
  total,
  carimbados,
  rodape,
}: {
  titulo: string;
  legenda: string;
  total: number;
  carimbados: number;
  rodape: string;
}) {
  const colunas = total === TOTAL_INDICACAO ? 6 : 7;
  return (
    <section className="ac-cartela" aria-label={titulo}>
      <div className="ac-cartela-topo">
        <div>
          <p className="ac-cartela-legenda">{legenda}</p>
          <h2 className="ac-cartela-titulo">{titulo}</h2>
        </div>
        <p className="ac-cartela-conta">
          <strong>{carimbados}</strong><small>/{total}</small>
        </p>
      </div>

      <ul className="ac-grade" style={{ gridTemplateColumns: `repeat(${colunas}, 1fr)` }}>
        {Array.from({ length: total }, (_, i) => {
          const feito = i < carimbados;
          const ultimo = i === total - 1;
          if (feito) {
            return (
              <li key={i} className="ac-marca feita">
                <Heart style={{ transform: `rotate(${INCLINACAO[i % INCLINACAO.length]}deg)` }} aria-hidden="true" />
                <span className="sr-only">Carimbo {i + 1} conquistado</span>
              </li>
            );
          }
          if (ultimo) {
            return (
              <li key={i} className="ac-marca presente">
                <Gift aria-hidden="true" />
                <span className="sr-only">Presente na {total}ª</span>
              </li>
            );
          }
          return (
            <li key={i} className="ac-marca vazia">
              <CakeSlice aria-hidden="true" />
              <span className="sr-only">Posição {i + 1} ainda livre</span>
            </li>
          );
        })}
      </ul>

      <p className="ac-cartela-rodape">{rodape}</p>
    </section>
  );
}

export default function AdoceClube() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    void loadConnectedClubSummary().then((resumo) => {
      if (resumo) setEstado({
        primeiroNome: resumo.firstName,
        codigo: resumo.memberCode,
        clube: resumo.progress % TOTAL_CLUBE,
        presentes: resumo.completedCycles,
        indicacoes: resumo.referralProgress % TOTAL_INDICACAO,
      });
    }).catch(() => undefined).finally(() => setCarregando(false));
  }, []);

  if (carregando) {
    return <main className="adoce-clube"><p className="ac-vazio">Abrindo seus cartões…</p></main>;
  }

  if (!estado) {
    return (
      <main className="adoce-clube">
        <div className="ac-convite">
          <img src="/site/logo.webp" alt="" aria-hidden="true" />
          <h1>Seu cartão do Clube</h1>
          <p>Entre com seu WhatsApp para ver seus carimbos e sua fatia-presente.</p>
          <a className="ac-principal" href="#entrar">Entrar no Clube</a>
        </div>
      </main>
    );
  }

  const faltam = TOTAL_CLUBE - estado.clube;

  return (
    <main className="adoce-clube">
      <header className="ac-topo">
        <div>
          <p className="ac-ola">Olá, {estado.primeiroNome}</p>
          <h1 className="ac-titulo">Seus cartões</h1>
        </div>
        <img className="ac-logo" src="/site/logo.webp" alt="" aria-hidden="true" />
      </header>

      {estado.presentes > 0 && (
        <section className="ac-presente" aria-label="Presente disponível">
          <div className="ac-presente-icone"><Gift aria-hidden="true" /></div>
          <p className="ac-presente-titulo">
            Você tem {estado.presentes} {estado.presentes === 1 ? "presente guardado" : "presentes guardados"}
          </p>
          <p className="ac-presente-texto">Use quando quiser. Ele espera por você, sem prazo.</p>
          <a className="ac-principal" href="#adoce-hoje">Escolher minha fatia-presente</a>
        </section>
      )}

      <Cartela
        legenda="Cartão fidelidade"
        titulo="Clube Adoce"
        total={TOTAL_CLUBE}
        carimbados={estado.clube}
        rodape={faltam === TOTAL_CLUBE
          ? "Cada fatia comprada vira um coração aqui."
          : `Faltam ${faltam} ${faltam === 1 ? "fatia" : "fatias"} para o seu presente`}
      />

      <Cartela
        legenda="Cartão de indicações"
        titulo="Compartilhe Doçura"
        total={TOTAL_INDICACAO}
        carimbados={estado.indicacoes}
        rodape="Cada amigo que provar pela primeira vez vira um coração aqui."
      />

      {/* Compartilhe Docura: a trilha de indicacao existe no banco (75 clientes
          ja tem cartao), mas a tela de convite ainda nao foi construida. O botao
          volta quando ela existir. */}

      {estado.codigo && (
        <section className="ac-codigo" aria-label="Seu código de membro">
          <p className="ac-codigo-legenda">Mostre no atendimento</p>
          <p className="ac-codigo-valor">{estado.codigo}</p>
          <p className="ac-codigo-nota">Identifica sua conta · não movimenta saldo</p>
        </section>
      )}

      {/* Carteira do celular: o cartao ja existe no banco e as 15 faixas de
          progresso estao prontas, mas falta o Issuer ID do Google Wallet.
          Mostrar o botao antes disso seria prometer o que nao entrega. */}
    </main>
  );
}
