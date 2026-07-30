import { useEffect, useMemo, useState } from "react";
import { Check, Clock3, LogIn, Nfc, RefreshCw, ShieldCheck } from "lucide-react";
import { rememberCustomerCheckInReturn } from "./customer-checkin-return";
import { getBffSession } from "./services/bff-auth";
import { clientBffRpc } from "./services/client-bff-rpc";
import "./customer-checkin-page.css";

type CheckInResult = {
  checkin_id: string;
  status: string;
  expires_at: string;
  store_name: string;
  duplicate: boolean;
};

function checkInTarget() {
  const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
  return {
    store: (params.get("loja") || "passare").trim().toLocaleLowerCase("pt-BR"),
    register: (params.get("caixa") || "principal").trim().toLocaleLowerCase("pt-BR"),
  };
}

function operationKey(store: string, register: string) {
  const storageKey = `adoce-checkin-operation:${store}:${register}`;
  const current = sessionStorage.getItem(storageKey);
  if (current) return current;
  const created = `customer-checkin:${store}:${register}:${crypto.randomUUID()}`;
  sessionStorage.setItem(storageKey, created);
  return created;
}

export default function CustomerCheckInPage() {
  const target = useMemo(checkInTarget, []);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [message, setMessage] = useState("");
  const [seconds, setSeconds] = useState(0);

  const checkIn = async () => {
    setLoading(true);
    setMessage("");
    try {
      rememberCustomerCheckInReturn();
      const session = await getBffSession();
      if (!session || session.user.surface !== "client") {
        setNeedsLogin(true);
        return;
      }
      const data = await clientBffRpc<CheckInResult>("customer_create_store_checkin", {
        store_slug: target.store,
        register_code: target.register,
        operation_key: operationKey(target.store, target.register),
      });
      setNeedsLogin(false);
      setResult(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível fazer o check-in.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void checkIn();
  }, []);

  useEffect(() => {
    if (!result?.expires_at) return;
    const update = () =>
      setSeconds(Math.max(0, Math.ceil((Date.parse(result.expires_at) - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [result?.expires_at]);

  return (
    <main className="customer-checkin-page">
      <section className="customer-checkin-card">
        <img src="/site/logo.webp" alt="Adoce Brigaderia" />
        <div className="customer-checkin-icon"><Nfc /></div>
        <small>Check-in rápido do Clube Adoce</small>
        <h1>Identifique-se no atendimento</h1>

        {loading ? (
          <div className="customer-checkin-state">
            <RefreshCw className="spin" />
            <strong>Confirmando seu acesso…</strong>
            <span>Isso leva apenas alguns segundos.</span>
          </div>
        ) : needsLogin ? (
          <div className="customer-checkin-state">
            <LogIn />
            <strong>Entre no Clube para continuar</strong>
            <span>Depois do login, você volta automaticamente para este check-in.</span>
            <a className="customer-checkin-primary" href="/#entrar">
              Entrar com biometria ou senha
            </a>
          </div>
        ) : result ? (
          <div className="customer-checkin-state success">
            <Check />
            <strong>Você já apareceu na tela da Adoce</strong>
            <span>{result.store_name || "Adoce"} pode identificar seu cadastro e lançar os carimbos.</span>
            <p><Clock3 /> Válido por mais {seconds} segundos</p>
            {seconds === 0 ? (
              <button className="customer-checkin-primary" onClick={() => void checkIn()}>
                Fazer novo check-in
              </button>
            ) : null}
          </div>
        ) : null}

        {message ? (
          <div className="customer-checkin-error" role="alert">
            <strong>Não foi possível concluir</strong>
            <span>{message}</span>
            <button onClick={() => void checkIn()}><RefreshCw /> Tentar novamente</button>
          </div>
        ) : null}

        <footer>
          <ShieldCheck />
          <span>O NFC e o QR não guardam seus dados. Eles apenas abrem esta página segura.</span>
        </footer>
      </section>
    </main>
  );
}
