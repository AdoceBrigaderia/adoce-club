import { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Mail,
  MessageCircle,
  ShieldCheck,
  Smartphone,
  UserRound,
} from "lucide-react";
import {
  normalizeCustomerName,
  shouldNormalizeCustomerName,
} from "./customer-name-normalization";
import {
  bffCompleteRegistration,
  bffRequestRegistrationEmailCode,
} from "./services/bff-auth";
import {
  requestAutomaticWhatsAppOtpBff,
  verifyAutomaticWhatsAppOtpBff,
} from "./services/whatsapp-otp-bff";
import "./customer-registration-page.css";

type Stage = "form" | "whatsapp" | "email" | "complete";

const referralCode = () =>
  new URLSearchParams(location.search).get("indicacao")?.trim().toUpperCase() ||
  "";

const normalizeBrazilPhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  const national = digits.startsWith("55") ? digits.slice(2) : digits;
  if (national.length !== 10 && national.length !== 11)
    throw new Error("Informe seu WhatsApp com DDD.");
  return `+55${national}`;
};

export default function CustomerRegistrationBffPage() {
  const [stage, setStage] = useState<Stage>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [marketingAccepted, setMarketingAccepted] = useState(false);
  const [whatsAppCode, setWhatsAppCode] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [whatsAppVerified, setWhatsAppVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const normalizedName = useMemo(() => normalizeCustomerName(name), [name]);
  const normalizedEmail = email.trim().toLocaleLowerCase("pt-BR");

  const normalizeNameInForm = () => {
    if (!shouldNormalizeCustomerName(name)) return;
    setName(normalizedName);
    setMessage(`Ajustamos seu nome para: ${normalizedName}`);
  };

  const validateForm = () => {
    if (normalizedName.split(" ").filter(Boolean).length < 2) {
      setMessage("Informe seu nome e sobrenome.");
      return false;
    }
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setMessage("Informe um e-mail válido.");
      return false;
    }
    try {
      normalizeBrazilPhone(phone);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Informe seu WhatsApp com DDD.",
      );
      return false;
    }
    if (!legalAccepted) {
      setMessage("Confirme os Termos do Clube e a Política de Privacidade.");
      return false;
    }
    return true;
  };

  const requestEmail = async () => {
    if (!validateForm()) return;
    setBusy(true);
    setMessage("");
    try {
      setName(normalizedName);
      await bffRequestRegistrationEmailCode({
        email: normalizedEmail,
        fullName: normalizedName,
      });
      setStage("email");
      setEmailCode("");
      setMessage(
        whatsAppVerified
          ? "WhatsApp confirmado. Agora enviamos o código final para seu e-mail."
          : "Enviamos um código para seu e-mail. Seu WhatsApp poderá ser validado depois.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar o código por e-mail.",
      );
    } finally {
      setBusy(false);
    }
  };

  const requestWhatsApp = async () => {
    if (!validateForm()) return;
    setBusy(true);
    setMessage("");
    try {
      setName(normalizedName);
      const challenge = await requestAutomaticWhatsAppOtpBff({
        phone,
        purpose: "registration",
        idempotencyKey: `registration:${normalizeBrazilPhone(phone)}:${crypto.randomUUID()}`,
      });
      setChallengeId(challenge.challengeId);
      setExpiresAt(challenge.expiresAt);
      setWhatsAppCode("");
      setStage("whatsapp");
      setMessage("Enviamos um código de 6 números para seu WhatsApp.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `${error.message} Você pode continuar pelo e-mail.`
          : "Não foi possível enviar o código pelo WhatsApp. Você pode continuar pelo e-mail.",
      );
    } finally {
      setBusy(false);
    }
  };

  const verifyWhatsApp = async () => {
    if (!challengeId || whatsAppCode.length !== 6) return;
    setBusy(true);
    setMessage("");
    try {
      await verifyAutomaticWhatsAppOtpBff(challengeId, whatsAppCode);
      setWhatsAppVerified(true);
      await bffRequestRegistrationEmailCode({
        email: normalizedEmail,
        fullName: normalizedName,
      });
      setStage("email");
      setEmailCode("");
      setMessage("WhatsApp confirmado. Enviamos o código final para seu e-mail.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Código inválido ou expirado.",
      );
    } finally {
      setBusy(false);
    }
  };

  const completeRegistration = async () => {
    if (emailCode.length !== 6 || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await bffCompleteRegistration({
        email: normalizedEmail,
        token: emailCode,
        fullName: normalizedName,
        phone: normalizeBrazilPhone(phone),
        marketingAccepted,
        whatsappChallengeId: whatsAppVerified ? challengeId : null,
        referralCode: referralCode() || null,
        remember: true,
      });
      setStage("complete");
      setMessage("Cadastro concluído. Abrindo seu Clube Adoce...");
      window.setTimeout(() => {
        location.hash = "minha-conta";
      }, 700);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível concluir seu cadastro.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="customer-registration-page">
      <header className="customer-registration-header">
        <a href="/#" aria-label="Voltar para a Adoce">
          <img src="/site/logo.webp" alt="Adoce Brigaderia" />
        </a>
        <a href="/#entrar">Já faço parte</a>
      </header>

      <section className="customer-registration-shell">
        <div className="customer-registration-intro">
          <small>Clube Adoce</small>
          <h1>Cadastro simples, rápido e protegido.</h1>
          <p>Cada fatia vale um carimbo. Complete 14 e ganhe uma fatia tradicional.</p>
          <div>
            <ShieldCheck />
            <span>Seus dados ficam protegidos e o WhatsApp evita cadastros duplicados.</span>
          </div>
        </div>

        <section className="customer-registration-card" aria-live="polite">
          <div className="customer-registration-progress">
            <span className={stage === "form" ? "active" : "done"}>1</span>
            <i />
            <span className={stage === "whatsapp" ? "active" : stage === "form" ? "" : "done"}>2</span>
            <i />
            <span className={stage === "email" ? "active" : stage === "complete" ? "done" : ""}>3</span>
          </div>

          {stage === "form" ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void requestWhatsApp();
              }}
            >
              <h2>Quero fazer parte</h2>
              <p>Preencha somente o necessário.</p>

              <label>
                Nome completo
                <span className="customer-registration-input">
                  <UserRound />
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    onBlur={normalizeNameInForm}
                    autoComplete="name"
                    data-person-name="true"
                    placeholder="Como podemos chamar você?"
                    required
                  />
                </span>
              </label>

              <label>
                WhatsApp com DDD
                <span className="customer-registration-input">
                  <Smartphone />
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    autoComplete="tel"
                    inputMode="tel"
                    placeholder="(85) 99999-9999"
                    required
                  />
                </span>
              </label>

              <label>
                E-mail
                <span className="customer-registration-input">
                  <Mail />
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    type="email"
                    placeholder="voce@exemplo.com"
                    required
                  />
                </span>
              </label>

              <div className="customer-registration-consents">
                <label className="required-consent">
                  <input
                    type="checkbox"
                    checked={legalAccepted}
                    onChange={(event) => setLegalAccepted(event.target.checked)}
                    required
                  />
                  <span>
                    Li e aceito os <a href="/#termos" target="_blank" rel="noreferrer">Termos do Clube</a> e estou ciente da <a href="/#privacidade" target="_blank" rel="noreferrer">Política de Privacidade</a>.
                  </span>
                </label>
                <label className="optional-consent">
                  <input
                    type="checkbox"
                    checked={marketingAccepted}
                    onChange={(event) => setMarketingAccepted(event.target.checked)}
                  />
                  <span>Quero receber sabores, novidades e promoções pelo WhatsApp. <em>Opcional</em></span>
                </label>
              </div>

              <button className="customer-registration-primary" disabled={busy}>
                {busy ? "Enviando código..." : "Validar meu WhatsApp"}
                <MessageCircle />
              </button>
              <button
                className="customer-registration-link"
                type="button"
                disabled={busy}
                onClick={() => void requestEmail()}
              >
                Continuar pelo e-mail
              </button>
            </form>
          ) : null}

          {stage === "whatsapp" ? (
            <section className="customer-registration-code-step">
              <MessageCircle />
              <h2>Confira seu WhatsApp</h2>
              <p>
                Digite o código de 6 números enviado para {phone}.
                {expiresAt
                  ? ` Ele expira às ${new Date(expiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`
                  : ""}
              </p>
              <input
                className="customer-registration-code"
                value={whatsAppCode}
                onChange={(event) =>
                  setWhatsAppCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                autoFocus
              />
              <button
                className="customer-registration-primary"
                disabled={busy || whatsAppCode.length !== 6}
                onClick={() => void verifyWhatsApp()}
              >
                {busy ? "Confirmando..." : "Confirmar WhatsApp"}
                <ArrowRight />
              </button>
              <button
                className="customer-registration-link"
                type="button"
                disabled={busy}
                onClick={() => void requestEmail()}
              >
                Não recebi; continuar pelo e-mail
              </button>
            </section>
          ) : null}

          {stage === "email" ? (
            <section className="customer-registration-code-step">
              <Mail />
              <h2>Última confirmação</h2>
              <p>Digite o código enviado para {normalizedEmail}.</p>
              <input
                className="customer-registration-code"
                value={emailCode}
                onChange={(event) =>
                  setEmailCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                autoFocus
              />
              <button
                className="customer-registration-primary"
                disabled={busy || emailCode.length !== 6}
                onClick={() => void completeRegistration()}
              >
                {busy ? "Criando seu Clube..." : "Concluir meu cadastro"}
                <ArrowRight />
              </button>
            </section>
          ) : null}

          {stage === "complete" ? (
            <section className="customer-registration-code-step complete">
              <CheckCircle2 />
              <h2>Seu Clube Adoce está pronto</h2>
              <p>Abrindo seu cartão digital...</p>
            </section>
          ) : null}

          {message ? (
            <p className="customer-registration-message" role="status">
              {message}
            </p>
          ) : null}
        </section>
      </section>
    </main>
  );
}
