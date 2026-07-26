import { useCallback, useEffect, useState } from "react";
import { Fingerprint, KeyRound, LogOut, ShieldCheck, Smartphone } from "lucide-react";
import OperationBusinessHub from "./OperationBusinessHub";
import { bffLogout, bffPasswordLogin, getBffSession, type BffSession } from "./services/bff-auth";
import { passkeysSupported, registerPasskeyBff, signInWithPasskeyBff } from "./services/bff-passkeys";
import "./passkey-operation-gateway.css";

const operationRoute = () =>
  location.hostname.toLowerCase().startsWith("operacao.") ||
  location.hash.startsWith("#operacao");

export default function PasskeyOperationGateway() {
  const [active, setActive] = useState(operationRoute);
  const [session, setSession] = useState<BffSession | null>(null);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [passkeyReady, setPasskeyReady] = useState(false);

  const refresh = useCallback(async () => {
    const next = await getBffSession().catch(() => null);
    setSession(next?.user.surface === "operation" ? next : null);
  }, []);

  useEffect(() => {
    const routeChanged = () => setActive(operationRoute());
    window.addEventListener("hashchange", routeChanged);
    setPasskeyReady(passkeysSupported());
    if (operationRoute()) void refresh();
    return () => window.removeEventListener("hashchange", routeChanged);
  }, [refresh]);

  if (!active) return null;

  const passwordLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const next = await bffPasswordLogin({ phone, password, surface: "operation", remember });
      if (next.mustChangePassword) {
        await bffLogout().catch(() => undefined);
        setMessage("Esta senha temporária precisa ser trocada antes do acesso. Use a recuperação segura da conta.");
        return;
      }
      setSession(next);
      setPassword("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível entrar na operação.");
    } finally {
      setBusy(false);
    }
  };

  const passkeyLogin = async () => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const next = await signInWithPasskeyBff("operation", remember);
      if (next.mustChangePassword) {
        await bffLogout().catch(() => undefined);
        setMessage("A troca da senha temporária ainda é obrigatória antes do acesso.");
        return;
      }
      setSession(next);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Não foi possível usar a biometria.";
      setMessage(text.includes("cancel") ? "A biometria foi cancelada." : text);
    } finally {
      setBusy(false);
    }
  };

  const registerThisDevice = async () => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await registerPasskeyBff("operation");
      setMessage(`Chave de acesso cadastrada${result.passkey.friendly_name ? `: ${result.passkey.friendly_name}` : " neste aparelho"}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível cadastrar este aparelho.");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await bffLogout();
    } finally {
      setSession(null);
      setBusy(false);
      setMessage("");
    }
  };

  return (
    <main className="passkey-operation-gateway">
      <header className="passkey-operation-header">
        <a href="/" aria-label="Voltar para Adoce Brigaderia">
          <img src="/site/logo.webp" alt="Adoce Brigaderia" />
          <span><strong>Adoce Operação</strong><small>Acesso seguro</small></span>
        </a>
        {session ? (
          <div className="passkey-operation-session-actions">
            {passkeyReady ? (
              <button type="button" onClick={() => void registerThisDevice()} disabled={busy}>
                <Fingerprint /> Ativar biometria neste aparelho
              </button>
            ) : null}
            <button type="button" onClick={() => void logout()} disabled={busy}>
              <LogOut /> Sair
            </button>
          </div>
        ) : null}
      </header>

      {session ? (
        <section className="passkey-operation-workspace">
          <div className="passkey-operation-welcome">
            <ShieldCheck />
            <span>
              <small>Sessão protegida por cookies HttpOnly</small>
              <strong>{session.user.fullName || "Adoce Operação"}</strong>
            </span>
          </div>
          {message ? <p className="passkey-operation-message" role="status">{message}</p> : null}
          <OperationBusinessHub />
        </section>
      ) : (
        <section className="passkey-operation-login">
          <div className="passkey-operation-copy">
            <ShieldCheck />
            <small>Operação rápida e segura</small>
            <h1>Entre sem perder tempo no atendimento.</h1>
            <p>Use a biometria do celular, o PIN do aparelho ou a senha da operação. Os tokens não ficam disponíveis para o navegador.</p>
          </div>

          <div className="passkey-operation-card">
            {passkeyReady ? (
              <button
                type="button"
                className="passkey-operation-biometric"
                onClick={() => void passkeyLogin()}
                disabled={busy}
              >
                <Fingerprint />
                <span><strong>Entrar com biometria</strong><small>Digital, Face ID, PIN ou chave de segurança</small></span>
              </button>
            ) : (
              <p className="passkey-operation-unsupported"><Smartphone /> Este navegador não oferece chave de acesso. Use a senha.</p>
            )}

            <div className="passkey-operation-divider"><span>ou use a senha</span></div>

            <form onSubmit={passwordLogin}>
              <label>
                Celular com DDD
                <span><Smartphone /><input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" autoComplete="username" placeholder="(85) 99999-9999" required /></span>
              </label>
              <label>
                Senha
                <span><KeyRound /><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" required /></span>
              </label>
              <label className="passkey-operation-remember">
                <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
                <span>Continuar conectado neste aparelho</span>
              </label>
              <button className="passkey-operation-submit" disabled={busy}>
                {busy ? "Entrando…" : "Entrar na operação"}
              </button>
            </form>
            {message ? <p className="passkey-operation-message" role="status">{message}</p> : null}
          </div>
        </section>
      )}
    </main>
  );
}
