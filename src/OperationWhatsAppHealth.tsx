import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { getBffSession } from "./services/bff-auth";
import { bffRpc } from "./services/bff-rpc";
import "./operation-whatsapp-health.css";

type Health = {
  configured: boolean;
  mode: "ready" | "incomplete";
  environment: string;
  missing: string[];
  graphApiVersion: string;
  templateName: string | null;
  phoneNumberId: string | null;
  wabaId: string | null;
  webhookPath: string;
  unitCostUsd: number;
  provider: string;
  secretsExposed: boolean;
  checkedAt: string;
};
type DailyMetric = {
  date: string;
  requested: number;
  delivered: number;
  verified: number;
  failed: number;
};
type Failure = {
  challenge_id: string;
  purpose: string;
  status: string;
  provider_error_code: string | null;
  provider_error_title: string | null;
  created_at: string;
};
type Metrics = {
  period_days: number;
  total: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  verified_count: number;
  unsuccessful_count: number;
  failed_count: number;
  delivery_rate: number;
  verification_rate: number;
  status_counts: Record<string, number>;
  purpose_counts: Record<string, number>;
  daily: DailyMetric[];
  recent_failures: Failure[];
  generated_at: string;
};

const periodOptions = [7, 30, 90] as const;
const moneyUsd = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
const dateTime = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Fortaleza",
});

async function fetchHealth() {
  const response = await fetch("/api/meta-whatsapp-health", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  const payload = (await response.json().catch(() => ({}))) as Health & {
    error?: string;
    code?: string;
  };
  if (!response.ok) {
    const error = new Error(
      payload.error || "Não foi possível consultar a configuração da Meta.",
    ) as Error & { code?: string };
    error.code = payload.code;
    throw error;
  }
  return payload;
}

export default function OperationWhatsAppHealth() {
  const [health, setHealth] = useState<Health | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [period, setPeriod] = useState<(typeof periodOptions)[number]>(30);
  const [manager, setManager] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const session = await getBffSession();
      const allowed =
        session?.user.surface === "operation" &&
        ["owner", "manager"].includes(session.user.role || "");
      setManager(Boolean(allowed));
      if (!allowed) return;

      const [nextHealth, nextMetrics] = await Promise.all([
        fetchHealth(),
        bffRpc<Metrics>("manager_get_whatsapp_otp_metrics", {
          requested_days: period,
        }),
      ]);
      setHealth(nextHealth);
      setMetrics(nextMetrics);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar a integração do WhatsApp.",
      );
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  const estimatedCost = useMemo(
    () => Number(metrics?.sent_count || 0) * Number(health?.unitCostUsd || 0),
    [health?.unitCostUsd, metrics?.sent_count],
  );

  if (manager === false) return null;

  return (
    <section className="whatsapp-health" aria-label="Integração WhatsApp">
      <header>
        <div>
          <small>Meta WhatsApp Cloud API</small>
          <h2>Saúde e custo do WhatsApp automático</h2>
          <p>
            Acompanhe configuração, entrega dos códigos, validações e custo
            estimado sem expor tokens ou segredos.
          </p>
        </div>
        <span className={health?.configured ? "ready" : "incomplete"}>
          {health?.configured ? <CheckCircle2 /> : <AlertTriangle />}
          {health?.configured ? "Pronto" : "Aguardando configuração"}
        </span>
      </header>

      <div className="whatsapp-health-toolbar">
        <div aria-label="Período">
          {periodOptions.map((days) => (
            <button
              type="button"
              key={days}
              className={period === days ? "active" : ""}
              onClick={() => setPeriod(days)}
            >
              {days} dias
            </button>
          ))}
        </div>
        <button type="button" onClick={() => void load()} disabled={loading}>
          <RefreshCw /> Atualizar
        </button>
      </div>

      {notice ? (
        <p className="whatsapp-health-notice" role="status">
          {notice}
        </p>
      ) : null}

      <div className="whatsapp-health-grid" aria-busy={loading}>
        <article>
          <MessageCircle />
          <span>Solicitados</span>
          <strong>{metrics?.total || 0}</strong>
          <small>{period} dias</small>
        </article>
        <article>
          <CheckCircle2 />
          <span>Entregues</span>
          <strong>{metrics?.delivered_count || 0}</strong>
          <small>{Number(metrics?.delivery_rate || 0).toFixed(1)}%</small>
        </article>
        <article>
          <ShieldCheck />
          <span>Verificados</span>
          <strong>{metrics?.verified_count || 0}</strong>
          <small>{Number(metrics?.verification_rate || 0).toFixed(1)}%</small>
        </article>
        <article>
          <AlertTriangle />
          <span>Falhas/bloqueios</span>
          <strong>{metrics?.unsuccessful_count || 0}</strong>
          <small>{metrics?.failed_count || 0} falha(s) da Meta</small>
        </article>
        <article className="cost">
          <span>Custo estimado</span>
          <strong>{moneyUsd(estimatedCost)}</strong>
          <small>
            {moneyUsd(health?.unitCostUsd || 0)} por mensagem considerada
          </small>
        </article>
      </div>

      <div className="whatsapp-health-details">
        <section>
          <h3>Configuração do ambiente</h3>
          <dl>
            <div>
              <dt>Ambiente</dt>
              <dd>{health?.environment || "—"}</dd>
            </div>
            <div>
              <dt>Graph API</dt>
              <dd>{health?.graphApiVersion || "—"}</dd>
            </div>
            <div>
              <dt>Template</dt>
              <dd>{health?.templateName || "Não configurado"}</dd>
            </div>
            <div>
              <dt>Phone Number ID</dt>
              <dd>{health?.phoneNumberId || "Não configurado"}</dd>
            </div>
            <div>
              <dt>WABA ID</dt>
              <dd>{health?.wabaId || "Não configurado"}</dd>
            </div>
            <div>
              <dt>Webhook</dt>
              <dd>{health?.webhookPath || "/api/whatsapp-cloud-webhook"}</dd>
            </div>
          </dl>
          {health?.missing?.length ? (
            <div className="whatsapp-health-missing">
              <strong>Faltam variáveis protegidas</strong>
              <ul>
                {health.missing.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="whatsapp-health-secure">
              <ShieldCheck /> Credenciais presentes. Nenhum segredo foi enviado
              ao navegador.
            </p>
          )}
        </section>

        <section>
          <h3>Falhas recentes</h3>
          {!metrics?.recent_failures?.length ? (
            <p className="whatsapp-health-empty">
              Nenhuma falha recente registrada.
            </p>
          ) : (
            <div className="whatsapp-health-failures">
              {metrics.recent_failures.map((failure) => (
                <article key={failure.challenge_id}>
                  <span>
                    <strong>{failure.status}</strong>
                    <small>{failure.purpose}</small>
                  </span>
                  <p>
                    {failure.provider_error_title ||
                      "Expirado ou bloqueado sem erro do provedor."}
                  </p>
                  <small>
                    {failure.provider_error_code
                      ? `Código ${failure.provider_error_code} · `
                      : ""}
                    {dateTime.format(new Date(failure.created_at))}
                  </small>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
