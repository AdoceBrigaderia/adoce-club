// Entrar no Clube Adoce — um campo so.
//
// O cadastro anterior pedia nome, telefone, e-mail e tres caixas de aceite, e
// existiam cinco formas de entrar: telefone com senha, e-mail com codigo,
// Google, Facebook e codigo de equipe. Cada campo a mais e gente desistindo, e
// cada dado guardado e responsabilidade sob a LGPD.
//
// Aqui: nome e WhatsApp, codigo pelo WhatsApp, pronto. Mesmo caminho para quem
// ja tem cartao e para quem esta chegando. Sem senha para esquecer.

import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, MessageCircle } from "lucide-react";
import "./adoce-entrar.css";

function formatarTelefone(valor: string) {
  const d = valor.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function temNomeESobrenome(valor: string) {
  return valor.trim().split(/\s+/).filter((p) => p.length >= 2).length >= 2;
}

export default function AdoceEntrar({ onEntrou }: { onEntrou?: () => void }) {
  const [etapa, setEtapa] = useState<"identificar" | "codigo">("identificar");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [segundos, setSegundos] = useState(0);
  const campoCodigo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (segundos <= 0) return;
    const t = window.setTimeout(() => setSegundos((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [segundos]);

  useEffect(() => {
    if (etapa === "codigo") campoCodigo.current?.focus();
  }, [etapa]);

  const pedirCodigo = (event?: FormEvent) => {
    event?.preventDefault();
    setAviso("");
    if (!temNomeESobrenome(nome)) {
      return setAviso("Escreva seu nome e sobrenome, para a gente saber como te chamar.");
    }
    if (telefone.replace(/\D/g, "").length < 10) {
      return setAviso("Confira o número do WhatsApp com o DDD.");
    }
    setAviso(
      "O envio de código pelo WhatsApp ainda está em validação. Use a tela de entrar atual.",
    );
  };

  const confirmar = (event: FormEvent) => {
    event.preventDefault();
    setAviso("");
    if (codigo.replace(/\D/g, "").length < 4) {
      return setAviso("Digite o código que chegou no seu WhatsApp.");
    }
    setAviso(
      "O envio de código pelo WhatsApp ainda está em validação. Use a tela de entrar atual.",
    );
  };

  return (
    <main className="adoce-entrar">
      {etapa === "codigo" && (
        <button type="button" className="ae-voltar" onClick={() => { setEtapa("identificar"); setCodigo(""); setAviso(""); }}>
          <ArrowLeft /> Voltar
        </button>
      )}

      <div className="ae-marca">
        <img src="/site/logo.webp" alt="Adoce Brigaderia" />
      </div>

      {etapa === "identificar" ? (
        <>
          <h1 className="ae-titulo">Bem-vindo de volta</h1>
          <p className="ae-sub">Seu cartão do Clube está esperando por você.</p>

          <form className="ae-form" onSubmit={pedirCodigo}>
            <label className="ae-campo">
              <span>Seu nome</span>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                autoComplete="name"
                placeholder="Nome e sobrenome"
                enterKeyHint="next"
              />
            </label>

            <label className="ae-campo">
              <span>Seu WhatsApp</span>
              <input
                value={telefone}
                onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
                inputMode="tel"
                autoComplete="tel"
                placeholder="(85) 90000-0000"
                enterKeyHint="go"
              />
            </label>

            {aviso && <p className="ae-aviso" role="alert">{aviso}</p>}

            <button className="ae-principal" type="submit" disabled={ocupado}>
              {ocupado ? "Enviando…" : "Receber meu código"}
            </button>
            <p className="ae-nota">
              Enviamos um código pelo WhatsApp. Sem senha para lembrar.
            </p>
          </form>

          <p className="ae-primeira">
            Primeira vez? É o mesmo caminho — a gente cria seu cartão na hora.
          </p>

          <p className="ae-privacidade">
            Pedimos só telefone e nome. Sem e-mail, sem senha, sem rede social 💗
          </p>
        </>
      ) : (
        <>
          <h1 className="ae-titulo">Confirme o código</h1>
          <p className="ae-sub">
            Enviamos pelo WhatsApp para <strong>{formatarTelefone(telefone)}</strong>.
          </p>

          <form className="ae-form" onSubmit={confirmar}>
            <label className="ae-campo">
              <span>Código</span>
              <input
                ref={campoCodigo}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                className="ae-codigo"
                enterKeyHint="go"
              />
            </label>

            {aviso && <p className="ae-aviso" role="alert">{aviso}</p>}

            <button className="ae-principal" type="submit" disabled={ocupado}>
              {ocupado ? "Conferindo…" : "Entrar no Clube"}
            </button>
          </form>

          <button
            type="button"
            className="ae-reenviar"
            disabled={segundos > 0 || ocupado}
            onClick={() => void pedirCodigo()}
          >
            <MessageCircle />
            {segundos > 0 ? `Pedir outro código em ${segundos}s` : "Pedir outro código"}
          </button>
        </>
      )}
    </main>
  );
}
