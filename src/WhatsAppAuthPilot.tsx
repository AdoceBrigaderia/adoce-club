import { FormEvent, useState } from "react";

type PilotStage = "identify" | "verify" | "complete";

export default function WhatsAppAuthPilot({ accessToken }: { accessToken: string }) {
  const [stage, setStage] = useState<PilotStage>("identify");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const start = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/whatsapp/start", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone,
          intent: "signup_or_login",
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        challenge_id?: string;
        masked_phone?: string;
        error?: string;
      };
      if (!response.ok || !payload.challenge_id)
        throw new Error(payload.error || "Não foi possível iniciar o piloto.");
      setChallengeId(payload.challenge_id);
      setMaskedPhone(payload.masked_phone || "telefone informado");
      setStage("verify");
      setMessage("Solicitação autorizada. Confira o WhatsApp controlado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao iniciar o piloto.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/whatsapp/verify", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ challenge_id: challengeId, phone, code }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        verified?: boolean;
        error?: string;
      };
      if (!response.ok || payload.verified !== true)
        throw new Error(payload.error || "Código inválido ou expirado.");
      setStage("complete");
      setMessage("Piloto concluído: entrega, OTP e verificação confirmados.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao verificar o piloto.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="operation-dashboard whatsapp-auth-pilot">
      <header>
        <div>
          <small>Piloto fechado</small>
          <h1>Autenticação por WhatsApp</h1>
          <p>
            Área exclusiva da operação. Nenhuma opção é exibida ao cliente enquanto
            as flags públicas permanecerem desligadas.
          </p>
        </div>
      </header>

      {stage === "identify" && (
        <form className="whatsapp-auth-pilot-form" onSubmit={start}>
          <label>
            Nome completo fictício ou controlado
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              autoComplete="off"
              required
            />
          </label>
          <label>
            WhatsApp controlado
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              inputMode="tel"
              autoComplete="off"
              placeholder="(85) 90000-0000"
              required
            />
          </label>
          <button type="submit" disabled={busy}>
            {busy ? "Solicitando…" : "Iniciar teste controlado"}
          </button>
        </form>
      )}

      {stage === "verify" && (
        <form className="whatsapp-auth-pilot-form" onSubmit={verify}>
          <p>Código enviado para {maskedPhone}.</p>
          <label>
            Código de 6 números
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              required
            />
          </label>
          <button type="submit" disabled={busy || code.length !== 6}>
            {busy ? "Verificando…" : "Verificar piloto"}
          </button>
        </form>
      )}

      {stage === "complete" && (
        <button
          type="button"
          onClick={() => {
            setStage("identify");
            setCode("");
            setChallengeId("");
            setMessage("");
          }}
        >
          Iniciar outro teste
        </button>
      )}

      {message && <p className="whatsapp-auth-pilot-message" role="status" aria-live="polite">{message}</p>}
    </section>
  );
}
