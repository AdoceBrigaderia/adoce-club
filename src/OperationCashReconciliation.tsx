import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  RefreshCw,
  WalletCards,
} from "lucide-react";
import { formatBusinessMoney } from "./cash-workspace";
import { bffRpc } from "./services/bff-rpc";
import "./operation-contingency.css";

type PendingSale = {
  id: string;
  order_id: string;
  order_number: string;
  store_id: string;
  store_name: string;
  payment_method_code: string;
  payment_method_label: string;
  amount: number | string;
  reason: string;
  created_by_name: string;
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
};
type CashSession = {
  id: string;
  store_id: string;
  register_id: string;
  status: "open" | "closed" | "cancelled";
  opened_at: string;
};
type Store = { id: string; name: string; active: boolean };
type Register = { id: string; store_id: string; name: string; active: boolean };
type Workspace = {
  role?: string;
  sessions?: CashSession[];
  stores?: Store[];
  registers?: Register[];
};

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Fortaleza",
});

export default function OperationCashReconciliation() {
  const [workspace, setWorkspace] = useState<Workspace>({});
  const [pending, setPending] = useState<PendingSale[]>([]);
  const [selectedSessions, setSelectedSessions] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextWorkspace, queue] = await Promise.all([
        bffRpc<Workspace>("staff_get_business_workspace"),
        bffRpc<PendingSale[]>("staff_get_cash_reconciliation_queue", {
          target_store_id: null,
        }),
      ]);
      setWorkspace(nextWorkspace || {});
      setPending(queue || []);
      const openSessions = (nextWorkspace.sessions || []).filter(
        (item) => item.status === "open",
      );
      setSelectedSessions((current) => {
        const next = { ...current };
        (queue || []).forEach((item) => {
          const currentSession = openSessions.find(
            (session) =>
              session.id === current[item.id] &&
              session.store_id === item.store_id,
          );
          next[item.id] =
            currentSession?.id ||
            openSessions.find((session) => session.store_id === item.store_id)
              ?.id ||
            "";
        });
        return next;
      });
      setNotice("");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Não foi possível consultar as vendas pendentes.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const manager = workspace.role === "owner" || workspace.role === "manager";
  const openSessions = useMemo(
    () =>
      (workspace.sessions || []).filter((item) => item.status === "open"),
    [workspace.sessions],
  );

  const sessionLabel = (session: CashSession) => {
    const store = (workspace.stores || []).find(
      (item) => item.id === session.store_id,
    );
    const register = (workspace.registers || []).find(
      (item) => item.id === session.register_id,
    );
    return `${store?.name || "Loja"} · ${register?.name || "Caixa"}`;
  };

  const reconcile = async (item: PendingSale) => {
    const sessionId = selectedSessions[item.id] || "";
    if (!sessionId)
      return setNotice(
        `Abra um caixa em ${item.store_name} antes de reconciliar esta venda.`,
      );

    setBusyId(item.id);
    setNotice("");
    try {
      const result = await bffRpc<{
        order_number?: string;
        amount?: number | string;
      }>("manager_reconcile_cash_sale", {
        target_reconciliation_id: item.id,
        target_session_id: sessionId,
        operation_key: `cash-reconciliation:${crypto.randomUUID()}`,
        next_notes: "Reconciliado pela Central da Operação",
      });
      setNotice(
        `Venda ${result.order_number || item.order_number} reconciliada em ${formatBusinessMoney(result.amount || item.amount)}.`,
      );
      await load();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Não foi possível reconciliar a venda.",
      );
    } finally {
      setBusyId("");
    }
  };

  if (!loading && !manager) return null;

  return (
    <section className="cash-reconciliation" aria-label="Vendas para reconciliar">
      <header>
        <div>
          <small>Contingência auditada</small>
          <h2>Vendas para reconciliar</h2>
          <p>
            Vincule ao caixa aberto as vendas registradas depois do atendimento.
            O valor, a forma de pagamento e o operador já vieram do banco.
          </p>
        </div>
        <span className="cash-reconciliation-count">
          <strong>{pending.length}</strong>
          <small>pendente(s)</small>
        </span>
      </header>

      <div className="cash-reconciliation-toolbar">
        <span>
          <WalletCards />
          {openSessions.length} caixa(s) aberto(s)
        </span>
        <button type="button" onClick={() => void load()} disabled={loading}>
          <RefreshCw /> Atualizar
        </button>
      </div>

      {notice ? (
        <p className="contingency-notice" role="status">
          {notice}
        </p>
      ) : null}

      {loading ? <p className="cash-reconciliation-empty">Carregando…</p> : null}
      {!loading && !pending.length ? (
        <p className="cash-reconciliation-empty">
          <CheckCircle2 /> Nenhuma venda aguardando reconciliação.
        </p>
      ) : null}

      <div className="cash-reconciliation-list">
        {pending.map((item) => {
          const compatible = openSessions.filter(
            (session) => session.store_id === item.store_id,
          );
          return (
            <article key={item.id}>
              <div className="cash-reconciliation-main">
                <span className="cash-reconciliation-icon">
                  <Clock3 />
                </span>
                <div>
                  <small>
                    {item.store_name} · {dateTime.format(new Date(item.created_at))}
                  </small>
                  <h3>Venda {item.order_number}</h3>
                  <p>
                    {item.customer_name || "Venda no atendimento"} · {item.reason}
                  </p>
                  <span>
                    {item.payment_method_label} · lançada por {item.created_by_name}
                  </span>
                </div>
                <strong>{formatBusinessMoney(item.amount)}</strong>
              </div>

              <div className="cash-reconciliation-actions">
                <label>
                  Caixa que receberá a venda
                  <select
                    value={selectedSessions[item.id] || ""}
                    onChange={(event) =>
                      setSelectedSessions((current) => ({
                        ...current,
                        [item.id]: event.target.value,
                      }))
                    }
                    disabled={busyId === item.id}
                  >
                    <option value="">Nenhum caixa aberto nesta loja</option>
                    {compatible.map((session) => (
                      <option value={session.id} key={session.id}>
                        {sessionLabel(session)}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => void reconcile(item)}
                  disabled={busyId === item.id || !selectedSessions[item.id]}
                >
                  {busyId === item.id
                    ? "Reconciliando…"
                    : "Reconciliar agora"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
