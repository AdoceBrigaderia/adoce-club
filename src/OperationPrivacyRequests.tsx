import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  Clock3,
  Download,
  FileJson,
  Mail,
  MessageCircle,
  RefreshCw,
  Send,
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
type PrivacyDeliveryChannel = "email" | "whatsapp" | "in_person" | "other";

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
  privacy_response_prepared_at: string | null;
  privacy_response_package_version: string | null;
  privacy_response_delivered_at: string | null;
  privacy_response_delivery_channel: PrivacyDeliveryChannel | null;
  privacy_response_delivery_notes: string | null;
  overdue: boolean;
  created_at: string;
  updated_at: string;
};

type PrivacyAccessPackage = {
  metadata: {
    protocol: string;
    package_version: string;
    generated_at: string;
    scope: string;
    notice: string;
  };
  profile: Record<string, unknown>;
  consents: unknown[];
  preferences: Record<string, unknown>;
  loyalty: {
    movement_count?: number;
    recent_movements?: unknown[];
    [key: string]: unknown;
  };
  orders: { total_count?: number; recent?: unknown[] };
  checkins: { total_count?: number; recent?: unknown[] };
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

const deliveryChannelLabel: Record<PrivacyDeliveryChannel, string> = {
  email: "E-mail",
  whatsapp: "WhatsApp",
  in_person: "Presencial",
  other: "Outro canal",
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

function packageJson(value: PrivacyAccessPackage) {
  return JSON.stringify(value, null, 2);
}

export default function OperationPrivacyRequests() {
  const [filter, setFilter] = useState<"all" | PrivacyStatus>("new");
  const [requests, setRequests] = useState<PrivacyRequest[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [accessPackages, setAccessPackages] = useState<
    Record<string, PrivacyAccessPackage>
  >({});
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
            updated[item.id] =
              item.internal_notes || item.privacy_identity_notes || "";
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
      setNotice(
        `Solicitação ${item.protocol} atualizada para ${statusLabel[nextStatus]}.`,
      );
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
      setNotice(
        `${item.protocol}: ${identityLabel[nextStatus].toLocaleLowerCase("pt-BR")}.`,
      );
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

  const prepareAccessPackage = async (item: PrivacyRequest) => {
    if (busyId) return;
    setBusyId(item.id);
    setNotice("");
    try {
      const result = await bffRpc<PrivacyAccessPackage>(
        "staff_prepare_privacy_access_response",
        { target_feedback_id: item.id },
      );
      setAccessPackages((current) => ({ ...current, [item.id]: result }));
      setNotice(
        `Pacote ${result.metadata.package_version} preparado para ${item.protocol}. Revise antes de enviar.`,
      );
      await load();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Não foi possível preparar o pacote de consulta.",
      );
    } finally {
      setBusyId("");
    }
  };

  const copyAccessPackage = async (item: PrivacyRequest) => {
    const value = accessPackages[item.id];
    if (!value) return;
    try {
      await navigator.clipboard.writeText(packageJson(value));
      setNotice(`Pacote de ${item.protocol} copiado. Revise o destinatário antes de enviar.`);
    } catch {
      setNotice("O navegador não permitiu copiar. Use o download do arquivo JSON.");
    }
  };

  const downloadAccessPackage = (item: PrivacyRequest) => {
    const value = accessPackages[item.id];
    if (!value) return;
    const blob = new Blob([packageJson(value)], { type: "application/json;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `adoce-privacidade-${item.protocol}.json`;
    anchor.click();
    URL.revokeObjectURL(href);
    setNotice(`Arquivo de ${item.protocol} gerado localmente. Confirme o destinatário antes do envio.`);
  };

  const markDelivered = async (
    item: PrivacyRequest,
    channel: PrivacyDeliveryChannel,
  ) => {
    if (busyId) return;
    setBusyId(item.id);
    setNotice("");
    try {
      await bffRpc("staff_mark_privacy_response_delivered", {
        target_feedback_id: item.id,
        requested_channel: channel,
        requested_delivery_notes: (notes[item.id] || "").slice(0, 1200),
      });
      setNotice(
        `${item.protocol}: entrega registrada por ${deliveryChannelLabel[channel]}.`,
      );
      await load();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Não foi possível registrar a entrega da resposta.",
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
          const identityRequired = identityRequiredTypes.has(
            item.privacy_request_type,
          );
          const canResolve = !identityRequired || identityStatus === "verified";
          const accessPackage = accessPackages[item.id];
          const canPrepareAccess =
            item.privacy_request_type === "access" &&
            identityStatus === "verified" &&
            Boolean(item.profile_id);
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
                  <small
                    className={item.overdue ? "privacy-due overdue" : "privacy-due"}
                  >
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
                    {item.privacy_response_prepared_at ? (
                      <span>
                        <strong>Pacote preparado</strong>
                        {dateTime.format(new Date(item.privacy_response_prepared_at))}
                      </span>
                    ) : null}
                    {item.privacy_response_delivered_at ? (
                      <span>
                        <strong>Resposta entregue</strong>
                        {dateTime.format(new Date(item.privacy_response_delivered_at))}
                        {item.privacy_response_delivery_channel
                          ? ` · ${deliveryChannelLabel[item.privacy_response_delivery_channel]}`
                          : ""}
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

                {item.privacy_request_type === "access" ? (
                  <section>
                    <h4>Pacote de consulta de dados</h4>
                    <p>
                      O pacote inclui dados do cadastro, consentimentos, preferências,
                      fidelidade, pedidos e check-ins vinculados. Anotações internas,
                      controles antifraude e dados de terceiros não são incluídos.
                    </p>
                    {!item.profile_id ? (
                      <p className="operation-privacy-notice" role="status">
                        <AlertTriangle /> Vincule esta solicitação ao cadastro correto antes
                        de preparar a resposta.
                      </p>
                    ) : null}
                    <div className="operation-privacy-actions">
                      <button
                        type="button"
                        onClick={() => void prepareAccessPackage(item)}
                        disabled={busy || !canPrepareAccess}
                      >
                        <FileJson /> Preparar pacote seguro
                      </button>
                      {accessPackage ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void copyAccessPackage(item)}
                            disabled={busy}
                          >
                            <ClipboardCopy /> Copiar JSON
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadAccessPackage(item)}
                            disabled={busy}
                          >
                            <Download /> Baixar JSON
                          </button>
                        </>
                      ) : null}
                    </div>
                    {accessPackage ? (
                      <div className="operation-privacy-metadata">
                        <span>
                          <strong>Versão</strong>
                          {accessPackage.metadata.package_version}
                        </span>
                        <span>
                          <strong>Movimentações</strong>
                          {Number(accessPackage.loyalty.movement_count || 0)}
                        </span>
                        <span>
                          <strong>Pedidos</strong>
                          {Number(accessPackage.orders.total_count || 0)}
                        </span>
                        <span>
                          <strong>Check-ins</strong>
                          {Number(accessPackage.checkins.total_count || 0)}
                        </span>
                      </div>
                    ) : null}
                    {item.privacy_response_prepared_at &&
                    !item.privacy_response_delivered_at ? (
                      <div className="operation-privacy-actions">
                        {item.customer_email ? (
                          <button
                            type="button"
                            onClick={() => void markDelivered(item, "email")}
                            disabled={busy}
                          >
                            <Send /> Registrar entrega por e-mail
                          </button>
                        ) : null}
                        {waUrl ? (
                          <button
                            type="button"
                            onClick={() => void markDelivered(item, "whatsapp")}
                            disabled={busy}
                          >
                            <Send /> Registrar entrega no WhatsApp
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </section>
                ) : null}

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
