// O balcao — a tela da Beth.
//
// Abre no que ela mais faz: achar o cliente. Busca grande, cursor dentro, nome
// ou telefone tanto faz. Embaixo, os ultimos atendidos, para na maioria das
// vezes ela nem precisar digitar.
//
// Um botao por linha. Sem menu, sem "ver detalhes", sem nada para decidir.
//
// Todo o resto da operacao — custos, relatorios, catalogo, configuracoes — sai
// da frente dela.

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Gift, Search, UserPlus, X } from "lucide-react";
import {
  acaoDe,
  buscarClientes,
  confirmacaoDeCarimbo,
  legendaDe,
  situacaoDe,
  ultimosAtendidos,
  type Cliente,
} from "./balcao-atendimento";
import "./balcao-atendimento.css";

export default function BalcaoAtendimento({
  clientes,
  onCarimbar,
  onEntregarPresente,
  onCadastrar,
  carregando = false,
}: {
  clientes: Cliente[];
  onCarimbar: (cliente: Cliente) => Promise<void> | void;
  onEntregarPresente: (cliente: Cliente) => Promise<void> | void;
  onCadastrar?: () => void;
  carregando?: boolean;
}) {
  const [termo, setTermo] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);
  const topo = useRef<HTMLDivElement>(null);

  // A Beth: "toda vez que entro em alguma tela da operacao ela abre no meio".
  // Aqui a tela sempre comeca do comeco.
  useEffect(() => {
    topo.current?.scrollIntoView({ block: "start" });
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 4000);
    return () => window.clearTimeout(t);
  }, [aviso]);

  const resultados = useMemo(() => buscarClientes(clientes, termo), [clientes, termo]);
  const recentes = useMemo(() => ultimosAtendidos(clientes), [clientes]);
  const buscando = termo.trim().length > 0;
  const lista = buscando ? resultados : recentes;

  const agir = async (cliente: Cliente) => {
    setOcupado(cliente.id);
    try {
      if (situacaoDe(cliente) === "presente") {
        await onEntregarPresente(cliente);
        setAviso(`Presente entregue para ${cliente.nome.split(/\s+/)[0]} 💗`);
      } else {
        await onCarimbar(cliente);
        setAviso(confirmacaoDeCarimbo(cliente).texto);
      }
      setTermo("");
      campo.current?.focus();
    } catch (erro) {
      setAviso(erro instanceof Error ? erro.message : "Não foi possível registrar agora.");
    } finally {
      setOcupado(null);
    }
  };

  return (
    <main className="balcao" ref={topo} aria-busy={carregando}>
      <div className="bal-busca">
        <Search aria-hidden="true" />
        <input
          ref={campo}
          type="search"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Nome ou telefone do cliente"
          autoComplete="off"
          autoFocus
          aria-label="Buscar cliente por nome ou telefone"
        />
        {termo ? (
          <button type="button" onClick={() => { setTermo(""); campo.current?.focus(); }} aria-label="Limpar busca">
            <X aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <p className="bal-dica">Digite 3 letras ou 4 números</p>

      {aviso ? <p className="bal-aviso" role="status">{aviso}</p> : null}

      <h2 className="bal-secao">{buscando ? "Resultados" : "Últimos atendidos"}</h2>

      {lista.length ? (
        <ul className="bal-lista">
          {lista.map((cliente) => {
            const situacao = situacaoDe(cliente);
            return (
              <li key={cliente.id} className={`bal-cliente bal-${situacao}`}>
                <div className="bal-cliente-texto">
                  <p className="bal-nome">{cliente.nome}</p>
                  <p className="bal-legenda">
                    {situacao === "presente" ? <Gift aria-hidden="true" /> : null}
                    {legendaDe(cliente)}
                  </p>
                </div>
                <button
                  type="button"
                  className={situacao === "presente" ? "bal-entregar" : "bal-carimbar"}
                  onClick={() => void agir(cliente)}
                  disabled={ocupado === cliente.id}
                >
                  {ocupado === cliente.id ? <Check aria-hidden="true" /> : null}
                  {acaoDe(cliente)}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="bal-vazio">
          {buscando
            ? "Ninguém com esse nome ou telefone. Vale cadastrar?"
            : "Ninguém atendido ainda hoje."}
        </p>
      )}

      {onCadastrar ? (
        <button type="button" className="bal-novo" onClick={onCadastrar}>
          <UserPlus aria-hidden="true" />
          <span>
            <strong>Cliente novo</strong>
            <small>Cadastrar em 10 segundos</small>
          </span>
        </button>
      ) : null}
    </main>
  );
}
