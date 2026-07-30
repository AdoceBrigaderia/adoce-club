import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
  Check,
  RefreshCw,
  WalletCards,
} from "lucide-react";
import { formatBusinessMoney } from "./cash-workspace";
import { bffRpc } from "./services/bff-rpc";
import {
  completeOperation,
  pendingOperationKey,
} from "./services/operation-idempotency";
import "./operation-quick-cash.css";

type CashSession = {
  id: string;
  store_id: string;
  register_id: string;
  status: "open" | "closed" | "cancelled";
  opened_at: string;
  expected_cash: number | string | null;
};
type Register = { id: string; store_id: string; name: string; active: boolean };
type Store = { id: string; name: string; active: boolean };
type Workspace = {
  role?: string;
  sessions?: CashSession[];
  registers?: Register[];
  stores?: Store[];
};

type MovementKind =
  | "supply"
  | "withdrawal"
  | "expense"
  | "adjustment_in"
  | "adjustment_out";

const movementOptions: Array<{
  kind: MovementKind;
  label: string;
  direction: "in" | "out";
  managerOnly?: boolean;
}> = [
  { kind: "supply", label: "Suprimento", direction: "in" },
  { kind: "withdrawal", label: "Sangria", direction: "out" },
  { kind: "expense", label: "Despesa", direction: "out", managerOnly: true },
  { kind: "adjustment_in", label: "Ajuste +", direction: "in", managerOnly: true },
  { kind: "adjustment_out", label: "Ajuste −", direction: "out", managerOnly: true },
];

const amountShortcuts = [10, 20, 50, 100, 200];
const reasonSuggestions: Record<MovementKind, string[]> = {
  supply: ["Troco adicional", "Reforço de caixa"],
  withdrawal: ["Retirada preventiva", "Envio para guarda"],
  expense: ["Compra emergencial", "Despesa operacional"],
  adjustment_in: ["Correção após conferência", "Entrada não registrada"],
  adjustment_out: ["Correção após conferência", "Saída não registrada"],
};

export default function OperationQuickCash() {
  const [workspace, setWorkspace] = useState<Workspace>({});
  const [sessionId, setSessionId] = useState("");
  const [kind, setKind] = useState<MovementKind>("supply");
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("Troco adicional");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await bffRpc<Workspace>("staff_get_business_workspace");
      setWorkspace(data || {});
      const opened = (data.sessions || []).filter((item) => item.status === "open");
      setSessionId((current) =>
        opened.some((item) => item.id === current) ? current : opened[0]?.id || "",
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Não foi possível abrir o caixa rápido.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sessions = useMemo(
    () => (workspace.sessions || []).filter((item) => item.status === "open"),
    [workspace.sessions],
  );
  const manager = workspace.role === "owner" || workspace.role === "manager";
  const visibleOptions = movementOptions.filter(
    (option) => !option.managerOnly || manager,
  );
  const currentSession = sessions.find((item) => item.id === sessionId) || null;

  const sessionLabel = (session: CashSession) => {
    const register = (workspace.registers || []).find(
      (item) => item.id === session.register_id,
    );
    const store = (workspace.stores || []).find(
      (item) => item.id === session.store_id,
    );
    return `${store?.name || "Loja"} · ${register?.name || "Caixa"}`;
  };

  const chooseKind = (next: MovementKind) => {
    setKind(next);
    setReason(reasonSuggestions[next][0]);
    setNotice("");
  };

  const submit = async () => {
    if (!sessionId) return setNotice("Abra um caixa antes de movimentar dinheiro.");
    if (!Number.isFinite(amount) || amount <= 0)
      return setNotice("Informe um valor maior que zero.");
    if (reason.trim().length < 3) return setNotice("Informe o motivo da movimentação.");

    setBusy(true);
    setNotice("");
    const operationPayload = {
      target_session_id: sessionId,
      movement_kind: kind,
      requested_payment_method: "cash",
      requested_amount: amount,
      next_notes: reason.trim(),
      target_order_id: null,
    };
    const operation = pendingOperationKey("cash-movement", operationPayload);
    try {
      await bffRpc("staff_record_cash_movement_v2", {
        requested_operation_key: operation.value,
        ...operationPayload,
      });
      completeOperation(operation.fingerprint);
      const selected = movementOptions.find((option) => option.kind === kind);
      setNotice(`${selected?.label || "Movimentação"} de ${formatBusinessMoney(amount)} registrada.`);
      setAmount(0);
      await load();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Não foi possível registrar a movimentação.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="quick-cash" aria-label="Caixa rápido">
      <header className="quick-cash-heading">
        <div>
          <small>Suprimento, sangria e correções em uma tela</small>
          <h2>Caixa rápido</h2>
          <p>Escolha o tipo, toque no valor e registre. As permissões continuam validadas no PostgreSQL.</p>
        </div>
        <WalletCards />
      </header>

      {notice ? <p className="quick-cash-notice" role="status">{notice}</p> : null}

      <div className="quick-cash-card">
        <div className="quick-cash-session">
          <label>
            Caixa aberto
            <select
              value={sessionId}
              onChange={(event) => setSessionId(event.target.value)}
              disabled={loading}
            >
              <option value="">Nenhum caixa aberto</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {sessionLabel(session)}
                </option>
              ))}
            </select>
          </label>
          <span>
            <small>Dinheiro esperado</small>
            <strong>{formatBusinessMoney(currentSession?.expected_cash)}</strong>
          </span>
          <button type="button" onClick={() => void load()} disabled={loading || busy}>
            <RefreshCw /> Atualizar
          </button>
        </div>

        {!sessions.length ? (
          <p className="quick-cash-empty"><Banknote /> Nenhum caixa aberto. Use a abertura de caixa logo abaixo.</p>
        ) : (
          <>
            <div className="quick-cash-kinds" aria-label="Tipo de movimentação">
              {visibleOptions.map((option) => (
                <button
                  type="button"
                  key={option.kind}
                  className={`${kind === option.kind ? "active " : ""}${option.direction}`}
                  onClick={() => chooseKind(option.kind)}
                >
                  {option.direction === "in" ? <ArrowDownToLine /> : <ArrowUpFromLine />}
                  {option.label}
                </button>
              ))}
            </div>

            <div className="quick-cash-values" aria-label="Atalhos de valor">
              {amountShortcuts.map((value) => (
                <button
                  type="button"
                  key={value}
                  className={amount === value ? "active" : ""}
                  onClick={() => setAmount(value)}
                >
                  {formatBusinessMoney(value)}
                </button>
              ))}
            </div>

            <label className="quick-cash-custom-value">
              Outro valor
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={amount || ""}
                onChange={(event) => setAmount(Number(event.target.value))}
                placeholder="0,00"
              />
            </label>

            <div className="quick-cash-reasons">
              <small>Motivo rápido</small>
              <div>
                {reasonSuggestions[kind].map((item) => (
                  <button
                    type="button"
                    key={item}
                    className={reason === item ? "active" : ""}
                    onClick={() => setReason(item)}
                  >
                    {reason === item ? <Check /> : null}{item}
                  </button>
                ))}
              </div>
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Outro motivo"
              />
            </div>

            <button
              type="button"
              className={`quick-cash-submit ${movementOptions.find((option) => option.kind === kind)?.direction || "in"}`}
              onClick={() => void submit()}
              disabled={busy || amount <= 0}
            >
              {busy ? "Registrando…" : `Registrar ${formatBusinessMoney(amount)}`}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
