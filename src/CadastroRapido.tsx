// Cadastro de cliente no balcao, em dez segundos.
//
// Dois campos e um botao. O cliente nao abre nada, nao instala nada e nao
// precisa mostrar a ninguem que esta sem internet — que e o motivo real de
// muita gente recusar o cadastro.
//
// Se o telefone ja existe, a tela para e oferece o cliente encontrado. Cadastro
// duplicado perde carimbo, e carimbo perdido e a unica coisa que o cartao de
// papel nunca fazia.

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, UserPlus } from "lucide-react";
import {
  FRASE_DE_CONSENTIMENTO,
  jaExiste,
  mascaraTelefone,
  paraEnvio,
  podeSalvar,
  validar,
  type Rascunho,
} from "./cadastro-rapido";
import "./cadastro-rapido.css";

export default function CadastroRapido({
  clientesConhecidos = [],
  onSalvar,
  onVoltar,
  onAbrirExistente,
}: {
  clientesConhecidos?: Array<{ id: string; nome: string; telefone: string }>;
  onSalvar: (dados: { nome: string; telefone: string }) => Promise<void> | void;
  onVoltar?: () => void;
  onAbrirExistente?: (id: string) => void;
}) {
  const [rascunho, setRascunho] = useState<Rascunho>({ nome: "", telefone: "" });
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const campoNome = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    campoNome.current?.focus();
  }, []);

  const problemas = validar(rascunho);
  const problemaDe = (campo: "nome" | "telefone") =>
    tentou ? problemas.find((p) => p.campo === campo)?.texto : undefined;

  const repetido = jaExiste(clientesConhecidos, rascunho.telefone);

  const salvar = async () => {
    setTentou(true);
    setErro(null);
    if (!podeSalvar(rascunho) || repetido) return;
    setSalvando(true);
    try {
      await onSalvar(paraEnvio(rascunho));
      setRascunho({ nome: "", telefone: "" });
      setTentou(false);
      campoNome.current?.focus();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível cadastrar agora.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <main className="cadastro">
      {onVoltar ? (
        <button type="button" className="cad-voltar" onClick={onVoltar}>
          <ArrowLeft aria-hidden="true" /> Voltar
        </button>
      ) : null}

      <h1 className="cad-titulo">Cliente novo</h1>
      <p className="cad-fala">“{FRASE_DE_CONSENTIMENTO}”</p>

      <label className="cad-campo">
        <span>Nome e sobrenome</span>
        <input
          ref={campoNome}
          type="text"
          value={rascunho.nome}
          onChange={(e) => setRascunho((r) => ({ ...r, nome: e.target.value }))}
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="next"
          aria-invalid={Boolean(problemaDe("nome"))}
        />
        {problemaDe("nome") ? <small role="alert">{problemaDe("nome")}</small> : null}
      </label>

      <label className="cad-campo">
        <span>WhatsApp</span>
        <input
          type="tel"
          inputMode="numeric"
          value={mascaraTelefone(rascunho.telefone)}
          onChange={(e) => setRascunho((r) => ({ ...r, telefone: e.target.value }))}
          placeholder="(85) 99999-9999"
          autoComplete="off"
          enterKeyHint="done"
          onKeyDown={(e) => { if (e.key === "Enter") void salvar(); }}
          aria-invalid={Boolean(problemaDe("telefone"))}
        />
        {problemaDe("telefone") ? <small role="alert">{problemaDe("telefone")}</small> : null}
      </label>

      {repetido ? (
        <div className="cad-repetido" role="status">
          <p><strong>{repetido.nome}</strong> já está cadastrado com esse WhatsApp.</p>
          {onAbrirExistente ? (
            <button type="button" onClick={() => onAbrirExistente(repetido.id)}>
              Abrir e carimbar
            </button>
          ) : null}
        </div>
      ) : null}

      {erro ? <p className="cad-erro" role="alert">{erro}</p> : null}

      <button
        type="button"
        className="cad-salvar"
        onClick={() => void salvar()}
        disabled={salvando || Boolean(repetido)}
      >
        {salvando ? <Check aria-hidden="true" /> : <UserPlus aria-hidden="true" />}
        {salvando ? "Cadastrando…" : "Cadastrar e carimbar"}
      </button>

      <p className="cad-nota">
        Só isso. O cliente não precisa abrir nada no celular dele.
      </p>
    </main>
  );
}
