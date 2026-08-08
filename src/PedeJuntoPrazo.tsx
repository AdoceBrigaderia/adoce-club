// A faixa de prazo do Pede Junto.
//
// Fica no topo da sala do grupo e responde, sem ninguem precisar perguntar:
// quanto tempo ainda tem, e quem ainda nao escolheu.
//
// A segunda parte e a que importa. Hoje o organizador cobra todo mundo no zap,
// se cansa e desiste â€” e a venda morre ai. Se a tela diz "faltam o Bruno e a
// Carla", ele cobra duas pessoas em vez de onze.
//
// O botao copia um lembrete pronto para o WhatsApp, sem link: quem nao tem
// internet nao abre link, e pedir isso constrange.

import { useEffect, useMemo, useState } from "react";
import { Check, Clock, Copy } from "lucide-react";
import type { PedeJuntoRoom } from "./pede-junto";
import {
  lembreteDeQuemFalta,
  prazoDoGrupo,
  proximaAtualizacaoMs,
} from "./pede-junto-prazo";
import "./pede-junto-prazo.css";

export default function PedeJuntoPrazo({ room }: { room: PedeJuntoRoom }) {
  const [agora, setAgora] = useState(() => Date.now());
  const [copiado, setCopiado] = useState(false);

  const prazo = useMemo(() => prazoDoGrupo(room, agora), [room, agora]);
  const lembrete = useMemo(() => lembreteDeQuemFalta(room, agora), [room, agora]);

  useEffect(() => {
    const intervalo = proximaAtualizacaoMs(prazo.restaMs);
    if (!intervalo) return;
    const timer = window.setInterval(() => setAgora(Date.now()), intervalo);
    return () => window.clearInterval(timer);
  }, [prazo.restaMs]);

  useEffect(() => {
    if (!copiado) return;
    const timer = window.setTimeout(() => setCopiado(false), 2500);
    return () => window.clearTimeout(timer);
  }, [copiado]);

  const copiarLembrete = async () => {
    try {
      await navigator.clipboard.writeText(lembrete);
      setCopiado(true);
    } catch {
      // Sem area de transferencia o texto continua visivel acima: da para
      // selecionar e copiar na mao. Melhor isso do que uma mensagem de erro
      // para algo que nao e essencial.
      setCopiado(false);
    }
  };

  if (prazo.urgencia === "encerrado" && room.status !== "open") return null;

  return (
    <section
      className={`pj-prazo pj-prazo-${prazo.urgencia}`}
      aria-label="Prazo do grupo"
    >
      <p className="pj-prazo-relogio">
        <Clock aria-hidden="true" />
        <strong>{prazo.relogio}</strong>
      </p>

      <p className="pj-prazo-frase">{prazo.frase}</p>

      {lembrete ? (
        <button
          type="button"
          className="pj-prazo-lembrete"
          onClick={() => void copiarLembrete()}
        >
          {copiado ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copiado ? "Mensagem copiada" : "Copiar lembrete para o WhatsApp"}
        </button>
      ) : null}
    </section>
  );
}

