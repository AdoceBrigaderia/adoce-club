import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import {
  CakeSlice,
  Check,
  Clock3,
  Fingerprint,
  Gift,
  Heart,
  KeyRound,
  LogOut,
  Nfc,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  UserRound,
} from "lucide-react";
import PasskeyManager from "./PasskeyManager";
import {
  clearCustomerCheckInReturn,
  pendingCustomerCheckInReturn,
} from "./customer-checkin-return";
import { bffLogout, bffPasswordLogin, getBffSession, type BffSession } from "./services/bff-auth";
import { passkeysSupported, signInWithPasskeyBff } from "./services/bff-passkeys";
import { clientBffRpc } from "./services/client-bff-rpc";
import "./passkey-client-gateway.css";

type CustomerWorkspace = {
  profile: {
    id: string;
    full_name: string;
    member_code: string;
    phone_e164: string | null;
    email: string;
    whatsapp_verified: boolean;
    account_status: string;
  };
  loyalty: {
    current_progress: number;
    completed_cards: number;
    available_rewards: number;
  };
  referral: {
    code: string;
    current_progress: number;
    completed_cards: number;
  };
  consents: Record<string, boolean>;
  preferences: Record<string, boolean>;
  recent_movements: Array<{
    id: string;
    reason: string;
    stamps_delta: number;
    resulting_progress: number;
    created_at: string;
  }>;
};

type IssuedQr = { token: string; expires_at: string };

const maskPhone = (value: string | null) => {
  const digits = (value || "").replace(/\D/g, "").replace(/^55/, "");
  if (digits.length < 10) return value || "WhatsApp não informado";
  return `(${digits.slice(0, 2)}) ${digits.slice(2, -4).replace(/.(?=.{3})/g, "•")}‑${digits.slice(-4)}`;
};

const reasonLabel = (reason: string) => ({
  purchase: "Compra registrada",
  manual_adjustment: "Ajuste da Adoce",
  reward_redeemed: "Fatia grátis resgatada",
  referral_bonus: "Bônus de indicação",
}[reason] || reason.replaceAll("_", " "));

export default function PasskeyClientGateway() {
  const [session, setSession] = useState<BffSession | null>(null);
  const [workspace, setWorkspace] = useState<CustomerWorkspace | null>(null);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [managePasskeys, setManagePasskeys] = useState(false);
  const [qrImage, setQrImage] = useState("");
  const [qrExpiresAt, setQrExpiresAt] = useState("");
  const [passkeyReady, setPasskeyReady] = useState(false);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const data = await clientBffRpc<CustomerWorkspace>("customer_get_account_workspace");
      setWorkspace({
        ...data,
        loyalty: {
          current_progress: Number(data.loyalty?.current_progress || 0),
          completed_cards: Number(data.loyalty?.completed_cards || 0),
          available_rewards: Number(data.loyalty?.available_rewards || 0),
        },
        recent_movements: data.recent_movements || [],
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível abrir seu Clube Adoce.");
    } finally {
      setLoading(false);
    }
  }, []);

  const continueAfterLogin = useCallback(() => {
    const pending = pendingCustomerCheckInReturn();
    if (pending) {
      clearCustomerCheckInReturn();
      window.location.hash = pending.slice(1);
      return true;
    }
    if (!window.location.hash.startsWith("#minha-conta"))
      window.location.hash = "minha-conta";
    return false;
  }, []);

  const refreshSession = useCallback(async () => {
    setLoading(true);
    const next = await getBffSession().catch(() => null);
    if (!next || next.user.surface !== "client") {
      setSession(null);
      setWorkspace(null);
      setLoading(false);
      return;
    }
    setSession(next);
    if (window.location.hash.startsWith("#entrar") && continueAfterLogin()) return;
    await loadWorkspace();
  }, [continueAfterLogin, loadWorkspace]);

  useEffect(() => {
    setPasskeyReady(passkeysSupported());
    void refreshSession();
  }, [refreshSession]);

  const passwordLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const next = await bffPasswordLogin({ phone, password, surface: "client", remember });
      if (next.mustChangePassword) {
        await bffLogout().catch(() => undefined);
        setMessage("Sua senha precisa ser atualizada antes do acesso. Use a recuperação pelo WhatsApp.");
        return;
      }
      setSession(next);
      setPassword("");
      if (!continueAfterLogin()) await loadWorkspace();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível entrar no Clube.");
    } finally {
      setBusy(false);
    }
  };

  const passkeyLogin = async () => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const next = await signInWithPasskeyBff("client", remember);
      if (next.mustChangePassword) {
        await bffLogout().catch(() => undefined);
        setMessage("Atualize sua senha temporária antes de usar a biometria.");
        return;
      }
      setSession(next);
      if (!continueAfterLogin()) await loadWorkspace();
    } catch (error) {
      const text = error instanceof Error ? error.message : "Não foi possível usar a biometria.";
      setMessage(text.toLocaleLowerCase("pt-BR").includes("cancel") ? "A biometria foi cancelada." : text);
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
      setWorkspace(null);
      setManagePasskeys(false);
      setQrImage("");
      setBusy(false);
      setMessage("");
      window.location.hash = "entrar";
    }
  };

  const issueQr = async () => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const raw = await clientBffRpc<IssuedQr | IssuedQr[]>("issue_customer_qr");
      const issued = Array.isArray(raw) ? raw[0] : raw;
      if (!issued?.token) throw new Error("Não foi possível gerar seu QR agora.");
      const target = new URL("/", window.location.origin);
      target.searchParams.set("cartao", issued.token);
      target.hash = "cartao";
      setQrImage(await QRCode.toDataURL(target.toString(), {
        width: 640,
        margin: 2,
        color: { dark: "#351812", light: "#fffaf7" },
        errorCorrectionLevel: "M",
      }));
      setQrExpiresAt(issued.expires_at);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível gerar seu QR.");
    } finally {
      setBusy(false);
    }
  };

  const firstName = useMemo(
    () => workspace?.profile.full_name?.trim().split(/\s+/)[0] || "Cliente",
    [workspace?.profile.full_name],
  );
  const progress = Math.max(0, Math.min(14, Number(workspace?.loyalty.current_progress || 0)));

  if (!session) {
    return (
      <main className="passkey-client-gateway login">
        <header className="passkey-client-header">
          <a href="/" aria-label="Voltar para Adoce Brigaderia">
            <img src="/site/logo.webp" alt="Adoce Brigaderia" />
            <span><strong>Clube Adoce</strong><small>Seu cartão digital</small></span>
          </a>
          <a href="/#cadastro">Criar cadastro</a>
        </header>
        <section className="passkey-client-login-shell">
          <div className="passkey-client-login-copy">
            <Heart />
            <small>Acesso rápido e protegido</small>
            <h1>Seu Clube Adoce sempre à mão.</h1>
            <p>Entre com a biometria do celular, o PIN do aparelho ou sua senha. Sua digital e seu Face ID nunca são enviados para a Adoce.</p>
          </div>
          <div className="passkey-client-login-card">
            {passkeyReady ? (
              <button className="passkey-client-biometric" type="button" onClick={() => void passkeyLogin()} disabled={busy}>
                <Fingerprint />
                <span><strong>Entrar com biometria</strong><small>Digital, Face ID, PIN ou chave de acesso</small></span>
              </button>
            ) : (
              <p className="passkey-client-unsupported"><Smartphone /> Este navegador não oferece chave de acesso. Use sua senha.</p>
            )}
            <div className="passkey-client-divider"><span>ou entre com sua senha</span></div>
            <form onSubmit={passwordLogin}>
              <label>
                WhatsApp com DDD
                <span><Smartphone /><input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" autoComplete="username" placeholder="(85) 99999-9999" required /></span>
              </label>
              <label>
                Senha
                <span><KeyRound /><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" required /></span>
              </label>
              <label className="passkey-client-remember">
                <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
                <span>Continuar conectado neste aparelho</span>
              </label>
              <button className="passkey-client-submit" disabled={busy}>{busy ? "Entrando…" : "Entrar no Clube"}</button>
            </form>
            <div className="passkey-client-login-links">
              <a href="/#cadastro">Quero fazer parte</a>
              <a href="/#cadastro">Recuperar acesso pelo WhatsApp</a>
            </div>
            {message ? <p className="passkey-client-message" role="status">{message}</p> : null}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="passkey-client-gateway account">
      <header className="passkey-client-header">
        <a href="/" aria-label="Adoce Brigaderia">
          <img src="/site/logo.webp" alt="Adoce Brigaderia" />
          <span><strong>Clube Adoce</strong><small>Área do cliente</small></span>
        </a>
        <div>
          {passkeyReady ? <button type="button" onClick={() => setManagePasskeys(true)}><Fingerprint /> Biometria</button> : null}
          <button type="button" onClick={() => void logout()} disabled={busy}><LogOut /> Sair</button>
        </div>
      </header>

      {loading && !workspace ? (
        <section className="passkey-client-loading"><RefreshCw className="spin" /><strong>Abrindo seu Clube Adoce…</strong></section>
      ) : workspace ? (
        <>
          <section className="passkey-client-welcome">
            <div><small>Área do cliente</small><h1>Olá, {firstName}!</h1><p>Seu cartão, seu QR e seus acessos seguros estão reunidos aqui.</p></div>
            <span><Gift /><strong>{workspace.loyalty.available_rewards}</strong><small>fatia(s) grátis</small></span>
          </section>

          {message ? <p className="passkey-client-message" role="status">{message}</p> : null}

          <section className="passkey-client-grid">
            <article className="passkey-client-loyalty-card">
              <header><div><small>CLUBE ADOCE</small><h2>Meu cartão digital</h2></div><img src="/site/logo.webp" alt="" /></header>
              <div className="passkey-client-member"><span>Código do membro</span><strong>{workspace.profile.member_code || "—"}</strong><small>{workspace.profile.full_name}</small></div>
              <div className="passkey-client-progress-title"><strong>{progress} de 14 carimbos</strong><span>{workspace.loyalty.available_rewards ? "Fatia grátis disponível" : `Faltam ${14 - progress}`}</span></div>
              <div className="passkey-client-stamps" aria-label={`${progress} de 14 carimbos`}>
                {Array.from({ length: 14 }, (_, index) => <span className={index < progress ? "filled" : ""} key={index}><Heart /></span>)}
              </div>
              <div className="passkey-client-card-actions">
                <button type="button" onClick={() => void issueQr()} disabled={busy}><QrCode /> Mostrar meu QR</button>
                <a href="/#adoce-hoje"><CakeSlice /> Sabores de hoje</a>
              </div>
            </article>

            <aside className="passkey-client-side">
              <article>
                <Nfc />
                <span><small>Identificação rápida</small><h3>Check-in no caixa</h3><p>Encoste no NFC ou leia o QR da Adoce. Depois confirme com biometria e seu cadastro aparece para a equipe.</p></span>
                <a href="/#check-in?loja=passare&caixa=principal">Abrir check-in</a>
              </article>
              <article>
                <UserRound />
                <span><small>Seu cadastro</small><h3>{workspace.profile.full_name}</h3><p>{maskPhone(workspace.profile.phone_e164)} · {workspace.profile.whatsapp_verified ? "WhatsApp confirmado" : "Confirmação pendente"}</p></span>
              </article>
              <article>
                <ShieldCheck />
                <span><small>Segurança</small><h3>Cookies HttpOnly</h3><p>A sessão não expõe seus tokens ao JavaScript. Cadastre biometria para entrar ainda mais rápido.</p></span>
                {passkeyReady ? <button type="button" onClick={() => setManagePasskeys(true)}>Gerenciar aparelhos</button> : null}
              </article>
            </aside>
          </section>

          <section className="passkey-client-history">
            <header><div><small>Últimas atualizações</small><h2>Movimentações do cartão</h2></div><button type="button" onClick={() => void loadWorkspace()} disabled={loading}><RefreshCw /> Atualizar</button></header>
            {!workspace.recent_movements.length ? <p>Nenhuma movimentação recente.</p> : workspace.recent_movements.map((entry) => (
              <article key={entry.id}>
                <span className={entry.stamps_delta >= 0 ? "positive" : "negative"}>{entry.stamps_delta > 0 ? "+" : ""}{entry.stamps_delta}</span>
                <div><strong>{reasonLabel(entry.reason)}</strong><small>{new Date(entry.created_at).toLocaleString("pt-BR")}</small></div>
                <b>{entry.resulting_progress}/14</b>
              </article>
            ))}
          </section>

          {qrImage ? (
            <div className="passkey-client-qr-layer" role="dialog" aria-modal="true" aria-label="QR do Clube Adoce">
              <button className="passkey-client-qr-backdrop" aria-label="Fechar" onClick={() => setQrImage("")} />
              <section>
                <QrCode /><small>Cartão Clube Adoce</small><h2>Mostre este QR no atendimento</h2>
                <div><img src={qrImage} alt="QR seguro do Clube Adoce" /><img src="/site/logo.webp" alt="" /></div>
                <strong>{qrExpiresAt ? <>Válido até <Clock3 /> {new Date(qrExpiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</> : "QR temporário"}</strong>
                <button type="button" onClick={() => setQrImage("")}><Check /> Concluir</button>
              </section>
            </div>
          ) : null}
          {managePasskeys ? <PasskeyManager surface="client" onClose={() => setManagePasskeys(false)} /> : null}
        </>
      ) : (
        <section className="passkey-client-loading"><ShieldCheck /><strong>Não foi possível abrir sua conta.</strong><button type="button" onClick={() => void refreshSession()}>Tentar novamente</button></section>
      )}
    </main>
  );
}
