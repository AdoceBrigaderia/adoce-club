import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Mail,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { bffRpc } from "./services/bff-rpc";
import "./operation-privacy-requests.css";

type PrivacyStatus = "new" | "reviewing" | "resolved" | "closed";
type PrivacyIdentityStatus = "pending" | "verified" | "rejected";
type PrivacyRequestType =
  | "access"
  | "correction"
  | "deletion"
  | "consent"
  | "other";

type PrivacyRequest = {
  id: string;
  protocol: string;
  profile_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  message: string;
  status: PrivacyStatus;
  internal_notes: string;
  privacy_request_type: PrivacyRequestType;
  privacy_due_at: string;
  privacy_resolved_at: string | null;
  privacy_closed_at: string | null;
  privacy_identity_status: PrivacyIdentityStatus;
  privacy_identity_checked_at: string | null;
  privacy_identity_notes: string | null;
  overdue: boolean;
  created_at: string;
  updated_at: string;
};

const filters: Array<{ value: "all" | PrivacyStatus; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "new", label: "Novas" },
  { value: "reviewing", label: "Em análise" },
  { value: "resolved", label: "Resolvidas" },
  { value: "closed", label: "Fechadas" },
];

const statusLabel: Record<PrivacyStatus, string> = {
  new: "Nova",
  reviewing: "Em análise",
  resolved: "Resolvida",
  closed: "Fechada",
};

const identityLabel: Record<PrivacyIdentityStatus, string> = {
  pending: "Identidade pendente",
  verified: "Identidade confirmada",
  rejected: "Identidade não confirmada",
};

const privacyTypeLabel: Record<PrivacyRequestType, string> = {
  access: "Consulta de dados",
  correction: "Correção de dados",
  deletion: "Exclusão ou anonimização",
  consent: "Consentimento",
  other: "Outro assunto",
};

const identityRequiredTypes = new Set<PrivacyRequestType>([
  "access",
  "correction",
  "deletion",
  "consent",
]);

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Fortaleza",
});

function whatsappUrl(value: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 10) return "";
  const international = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${international}`;
}

export default function OperationPrivacyRequests() {
  const [filter, setFilter] = useState<"all" | PrivacyStatus>("new");
  const [requests, setRequests] = useState<PrivacyRequest[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const [hidden, setHidden] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const result = await bffRpc<PrivacyRequest[]>(
        "staff_list_privacy_requests",
        {
          requested_status: filter === "all" ? null : filter,
          requested_limit: 60,
        },
      );
      const next = Array.isArray(result) ? result : [];
      setRequests(next);
      setNotes((current) => {
        const updated = { ...current };
        next.forEach((item) => {
          if (!(item.id in updated)) {
            updated[item.id] = item.internal_notes || item.privacy_identity_notes || "";
          }
        });
        return updated;
      });
      setHidden(false);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível abrir as solicitações de privacidade.";
      if (message.toLocaleLowerCase("pt-BR").includes("não autorizado")) {
        setHidden(true);
        setRequests([]);
      } else {
        setNotice(message);
      }
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingCount = useMemo(
    () => requests.filter((item) => item.status === "new").length,
    [requests],
  );
  const overdueCount = useMemo(
    () => requests.filter((item) => item.overdue).length,
    [requests],
  );

  const update = async (item: PrivacyRequest, nextStatus: PrivacyStatus) => {
    if (busyId) return;
    setBusyId(item.id);
    setNotice("");
    try {
      await bffRpc("staff_update_privacy_request", {
        target_feedback_id: item.id,
        requested_status: nextStatus,
        requested_internal_notes: notes[item.id] || "",
      });
      setNotice(`Solicitação ${item.protocol} atualizada para ${statusLabel[nextStatus]}.`);
      await load();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar a solicitação.",
      );
    } finally {
      setBusyId("");
    }
  };

  const verifyIdentity = async (
    item: PrivacyRequest,
    nextStatus: PrivacyIdentityStatus,
  ) => {
    if (busyId) return;
    setBusyId(item.id);
    setNotice("");
    try {
      await bffRpc("staff_verify_privacy_request_identity", {
        target_feedback_id: item.id,
        requested_identity_status: nextStatus,
        requested_verification_notes: notes[item.id] || "",
      });
      setNotice(`${item.protocol}: ${identityLabel[nextStatus].toLocaleLowerCase("pt-BR")}.`);
      await load();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Não foi possível registrar a verificação de identidade.",
      );
    } finally {
      setBusyId("");
    }
  };

  if (hidden) return null;

  return (
    <section
      className="operation-privacy-requests"
      aria-label="Solicitações de privacidade"
    >
      <header>
        <div>
          <small>Dados pessoais</small>
          <h2>Solicitações de privacidade</h2>
          <p>
            Consulte protocolos, confirme a identidade do solicitante e preserve a
            rastreabilidade das respostas ao cliente.
          </p>
        </div>
        <span className={overdueCount ? "has-overdue" : ""}>
          {overdueCount ? <AlertTriangle /> : <ShieldCheck />}
          <strong>{overdueCount || pendingCount}</strong>
          <small>{overdueCount ? "atrasada(s)" : "nova(s)"}</small>
        </span>
      </header>

      <div className="operation-privacy-toolbar">
        <div role="group" aria-label="Filtrar solicitações">
          {filters.map((option) => (
            <button
              type="button"
              key={option.value}
              className={filter === option.value ? "active" : ""}
              onClick={() => setFilter(option.value)}
              disabled={loading || Boolean(busyId)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => void load()} disabled={loading}>
          <RefreshCw /> Atualizar
        </button>
      </div>

      {notice ? (
        <p className="operation-privacy-notice" role="status">
          {notice}
        </p>
      ) : null}

      {loading ? (
        <p className="operation-privacy-empty">Carregando solicitações…</p>
      ) : null}
      {!loading && !requests.length ? (
        <p className="operation-privacy-empty">
          <CheckCircle2 /> Nenhuma solicitação neste filtro.
        </p>
      ) : null}

      <div className="operation-privacy-list">
        {requests.map((item) => {
          const waUrl = whatsappUrl(item.customer_phone);
          const busy = busyId === item.id;
          const requestType =
            privacyTypeLabel[item.privacy_request_type] || privacyTypeLabel.other;
          const identityStatus = item.privacy_identity_status || "pending";
          const identityRequired = identityRequiredTypes.has(item.privacy_request_type);
          const canResolve = !identityRequired || identityStatus === "verified";
          return (
            <details
              key={item.id}
              open={item.status === "new" || item.overdue}
              className={item.overdue ? "overdue" : ""}
            >
              <summary>
                <span className={`status ${item.status}`}>
                  {statusLabel[item.status]}
                </span>
                <div>
                  <small>
                    <Clock3 /> {dateTime.format(new Date(item.created_at))}
                  </small>
                  <h3>{item.customer_name}</h3>
                  <span className="privacy-kind">{requestType}</span>
                  <p>{item.message}</p>
                  <small className={item.overdue ? "privacy-due overdue" : "privacy-due"}>
                    {item.overdue ? <AlertTriangle /> : <Clock3 />}
                    Prazo interno: {dateTime.format(new Date(item.privacy_due_at))}
                  </small>
                </div>
                <strong>{item.protocol}</strong>
              </summary>

              <div className="operation-privacy-body">
                <section>
                  <h4>Solicitação</h4>
                  <div className="operation-privacy-metadata">
                    <span>
                      <strong>Tipo</strong>
                      {requestType}
                    </span>
                    <span className={item.overdue ? "overdue" : ""}>
                      <strong>Prazo interno</strong>
                      {dateTime.format(new Date(item.privacy_due_at))}
                    </span>
                    <span>
                      <strong>Identidade</strong>
                      {identityLabel[identityStatus]}
                    </span>
                    {item.privacy_identity_checked_at ? (
                      <span>
                        <strong>Conferida em</strong>
                        {dateTime.format(new Date(item.privacy_identity_checked_at))}
                      </span>
                    ) : null}
                    {item.privacy_resolved_at ? (
                      <span>
                        <strong>Resolvida em</strong>
                        {dateTime.format(new Date(item.privacy_resolved_at))}
                      </span>
                    ) : null}
                  </div>
                  <p>{item.message}</p>
                  <div className="operation-privacy-contact">
                    {item.customer_email ? (
                      <a
                        href={`mailto:${item.customer_email}?subject=${encodeURIComponent(`Privacidade Adoce · ${item.protocol}`)}`}
                      >
                        <Mail /> Responder por e-mail
                      </a>
                    ) : null}
                    {waUrl ? (
                      <a href={waUrl} target="_blank" rel="noreferrer">
                        <MessageCircle /> Responder no WhatsApp
                      </a>
                    ) : null}
                  </div>
                </section>

                <label>
                  Anotação interna
                  <textarea
                    value={notes[item.id] || ""}
                    maxLength={3000}
                    onChange={(event) =>
                      setNotes((current) => ({
                        ...current,
                        [item.id]: event.target.value,
                      }))
                    }
                    placeholder="Registre como a identidade foi conferida e o que foi respondido ou executado."
                    disabled={busy}
                  />
                </label>

                <section>
                  <h4>Confirmação de identidade</h4>
                  <p>
                    Antes de consultar, corrigir, excluir dados ou alterar consentimentos,
                    confirme que o contato pertence ao titular. Não registre documentos ou
                    códigos completos nesta anotação.
                  </p>
                  <div className="operation-privacy-actions">
                    <button
                      type="button"
                      onClick={() => void verifyIdentity(item, "pending")}
                      disabled={busy || identityStatus === "pending"}
                    >
                      Manter pendente
                    </button>
                    <button
                      type="button"
                      onClick={() => void verifyIdentity(item, "verified")}
                      disabled={busy || identityStatus === "verified"}
                    >
                      Identidade confirmada
                    </button>
                    <button
                      type="button"
                      onClick={() => void verifyIdentity(item, "rejected")}
                      disabled={busy || identityStatus === "rejected"}
                    >
                      Não confirmada
                    </button>
                  </div>
                  {!canResolve ? (
                    <p className="operation-privacy-notice" role="status">
                      <AlertTriangle /> Este tipo de solicitação só pode ser marcado como
                      resolvido depois da confirmação de identidade.
                    </p>
                  ) : null}
                </section>

                <div className="operation-privacy-actions">
                  <button
                    type="button"
                    onClick={() => void update(item, "reviewing")}
                    disabled={busy || item.status === "reviewing"}
                  >
                    Em análise
                  </button>
                  <button
                    type="button"
                    onClick={() => void update(item, "resolved")}
                    disabled={busy || item.status === "resolved" || !canResolve}
                  >
                    Marcar resolvida
                  </button>
                  <button
                    type="button"
                    onClick={() => void update(item, "closed")}
                    disabled={busy || item.status === "closed"}
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
