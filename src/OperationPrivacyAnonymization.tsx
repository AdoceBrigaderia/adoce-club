import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { getBffSession } from "./services/bff-auth";
import { bffRpc } from "./services/bff-rpc";
import "./operation-privacy-anonymization.css";

type DeletionRequest = {
  id: string;
  protocol: string;
  profile_id: string | null;
  customer_name: string;
  status: "new" | "reviewing" | "resolved" | "closed";
  privacy_identity_status: "pending" | "verified" | "rejected";
  privacy_due_at: string;
  overdue: boolean;
};

type AnonymizationPlan = {
  id: string;
  protocol: string;
  profile_id: string;
  profile_name: string;
  ready: boolean;
  blockers: {
    staff_profile: boolean;
    open_orders: number;
    open_service_requests: number;
    shared_loyalty_accounts: number;
  };
  impact: {
    loyalty_accounts: number;
    available_rewards_to_reverse: number;
    orders_to_anonymize: number;
    service_requests_to_anonymize: number;
    checkins_to_remove: number;
  };
  confirmation_required: string;
};

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Fortaleza",
});

export default function OperationPrivacyAnonymization() {
  const [owner, setOwner] = useState<boolean | null>(null);
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [plans, setPlans] = useState<Record<string, AnonymizationPlan>>({});
  const [confirmations, setConfirmations] = useState<Record<string, string>>({});
  const [acknowledged, setAcknowledged] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const session = await getBffSession();
      const isOwner =
        session?.user.surface === "operation" && session.user.role === "owner";
      setOwner(Boolean(isOwner));
      if (!isOwner) {
        setRequests([]);
        return;
      }

      const result = await bffRpc<DeletionRequest[]>(
        "staff_list_privacy_requests",
        { requested_status: null, requested_limit: 100 },
      );
      setRequests(
        (Array.isArray(result) ? result : []).filter(
          (item) =>
            item.status !== "resolved" &&
            item.status !== "closed" &&
            (item as DeletionRequest & { privacy_request_type?: string })
              .privacy_request_type === "deletion",
        ),
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Não foi possível consultar pedidos de anonimização.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const blockerCount = useMemo(
    () =>
      Object.values(plans).filter((plan) => !plan.ready).length,
    [plans],
  );

  const review = async (item: DeletionRequest) => {
    if (busyId) return;
    setBusyId(item.id);
    setNotice("");
    try {
      const plan = await bffRpc<AnonymizationPlan>(
        "staff_get_privacy_anonymization_plan",
        { target_feedback_id: item.id },
      );
      setPlans((current) => ({ ...current, [item.id]: plan }));
      setConfirmations((current) => ({ ...current, [item.id]: "" }));
      setAcknowledged((current) => ({ ...current, [item.id]: false }));
      setNotice(
        plan.ready
          ? `${item.protocol}: revisão concluída e sem bloqueios ativos.`
          : `${item.protocol}: resolva os bloqueios antes de anonimizar.`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Não foi possível revisar o impacto da anonimização.",
      );
    } finally {
      setBusyId("");
    }
  };

  const anonymize = async (item: DeletionRequest) => {
    const plan = plans[item.id];
    if (
      busyId ||
      !plan?.ready ||
      confirmations[item.id] !== item.protocol ||
      !acknowledged[item.id]
    ) {
      return;
    }

    setBusyId(item.id);
    setNotice("");
    try {
      await bffRpc("staff_anonymize_privacy_profile", {
        target_feedback_id: item.id,
        requested_confirmation: confirmations[item.id],
      });
      setNotice(
        `${item.protocol}: cadastro anonimizado, sessões revogadas e protocolo resolvido.`,
      );
      setPlans((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      await load();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Não foi possível executar a anonimização protegida.",
      );
    } finally {
      setBusyId("");
    }
  };

  if (owner === false) return null;

  return (
    <section
      className="privacy-anonymization"
      aria-label="Exclusão e anonimização de cadastros"
    >
      <header>
        <div>
          <small>Ação exclusiva do proprietário</small>
          <h2>Exclusão e anonimização</h2>
          <p>
            Revise bloqueios e impacto antes de remover dados identificáveis. A operação
            preserva apenas registros financeiros e de auditoria sem contato direto.
          </p>
        </div>
        <span className={blockerCount ? "blocked" : "ready"}>
          {blockerCount ? <AlertTriangle /> : <ShieldCheck />}
          {blockerCount ? `${blockerCount} bloqueada(s)` : "Protegido"}
        </span>
      </header>

      <div className="privacy-anonymization-toolbar">
        <strong>{requests.length} solicitação(ões) pendente(s)</strong>
        <button type="button" onClick={() => void load()} disabled={loading}>
          <RefreshCw /> Atualizar
        </button>
      </div>

      {notice ? (
        <p className="privacy-anonymization-notice" role="status">
          {notice}
        </p>
      ) : null}

      {loading ? <p className="privacy-anonymization-empty">Carregando…</p> : null}
      {!loading && !requests.length ? (
        <p className="privacy-anonymization-empty">
          Nenhuma solicitação de exclusão aguardando análise.
        </p>
      ) : null}

      <div className="privacy-anonymization-list">
        {requests.map((item) => {
          const plan = plans[item.id];
          const busy = busyId === item.id;
          const confirmationMatches = confirmations[item.id] === item.protocol;
          return (
            <article key={item.id} className={item.overdue ? "overdue" : ""}>
              <div className="privacy-anonymization-title">
                <div>
                  <small>
                    Prazo interno: {dateTime.format(new Date(item.privacy_due_at))}
                  </small>
                  <h3>{item.customer_name}</h3>
                  <span>{item.protocol}</span>
                </div>
                <button type="button" onClick={() => void review(item)} disabled={busy}>
                  <ShieldCheck /> Revisar impacto
                </button>
              </div>

              {item.privacy_identity_status !== "verified" ? (
                <p className="privacy-anonymization-warning">
                  <AlertTriangle /> A identidade ainda não foi confirmada na fila de
                  privacidade.
                </p>
              ) : null}

              {plan ? (
                <div className="privacy-anonymization-plan">
                  <div className="privacy-anonymization-grid">
                    <span>
                      <strong>Pedidos em aberto</strong>
                      {plan.blockers.open_orders}
                    </span>
                    <span>
                      <strong>Atendimentos em aberto</strong>
                      {plan.blockers.open_service_requests}
                    </span>
                    <span>
                      <strong>Contas compartilhadas</strong>
                      {plan.blockers.shared_loyalty_accounts}
                    </span>
                    <span>
                      <strong>Perfil da equipe</strong>
                      {plan.blockers.staff_profile ? "Sim" : "Não"}
                    </span>
                    <span>
                      <strong>Pedidos a anonimizar</strong>
                      {plan.impact.orders_to_anonymize}
                    </span>
                    <span>
                      <strong>Recompensas a reverter</strong>
                      {plan.impact.available_rewards_to_reverse}
                    </span>
                    <span>
                      <strong>Check-ins a remover</strong>
                      {plan.impact.checkins_to_remove}
                    </span>
                  </div>

                  {!plan.ready ? (
                    <p className="privacy-anonymization-warning">
                      <AlertTriangle /> Há vínculos operacionais que precisam ser resolvidos
                      antes da anonimização.
                    </p>
                  ) : (
                    <div className="privacy-anonymization-confirmation">
                      <p>
                        Esta ação é irreversível. Digite exatamente <strong>{item.protocol}</strong>
                        para confirmar.
                      </p>
                      <input
                        value={confirmations[item.id] || ""}
                        onChange={(event) =>
                          setConfirmations((current) => ({
                            ...current,
                            [item.id]: event.target.value,
                          }))
                        }
                        placeholder={item.protocol}
                        autoComplete="off"
                        disabled={busy}
                      />
                      <label>
                        <input
                          type="checkbox"
                          checked={Boolean(acknowledged[item.id])}
                          onChange={(event) =>
                            setAcknowledged((current) => ({
                              ...current,
                              [item.id]: event.target.checked,
                            }))
                          }
                          disabled={busy}
                        />
                        Revisei os bloqueios, o impacto e confirmei o titular correto.
                      </label>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => void anonymize(item)}
                        disabled={busy || !confirmationMatches || !acknowledged[item.id]}
                      >
                        <Trash2 /> Anonimizar definitivamente
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
