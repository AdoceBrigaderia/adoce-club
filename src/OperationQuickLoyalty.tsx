import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Heart,
  Minus,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { bffRpc } from "./services/bff-rpc";
import "./operation-quick-loyalty.css";

type CustomerRow = {
  profile_id: string;
  account_id: string;
  full_name: string;
  phone_e164: string | null;
  email: string | null;
  current_progress: number;
  completed_cards: number;
  available_rewards: number;
  available_reward_id: string | null;
};

type AdjustmentResult = {
  track_id: string;
  progress: number;
  completed_cards: number;
  new_rewards?: number;
  reversed_rewards?: number;
  ledger_entry_id?: string;
};

const quickReasons = [
  "Compra não lançada na hora",
  "Correção do atendimento",
  "Cortesia autorizada",
  "Ajuste após conferência",
];

const maskPhone = (value: string | null) => {
  const digits = (value || "").replace(/\D/g, "").replace(/^55/, "");
  if (digits.length < 10) return value || "Sem telefone";
  return `(${digits.slice(0, 2)}) ${digits.slice(2, -4).replace(/.(?=.{3})/g, "•")}‑${digits.slice(-4)}`;
};

export default function OperationQuickLoyalty() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerRow[]>([]);
  const [selected, setSelected] = useState<CustomerRow | null>(null);
  const [delta, setDelta] = useState(1);
  const [reason, setReason] = useState(quickReasons[0]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const searchCustomers = useCallback(async (searchText = query) => {
    setLoading(true);
    try {
      const data = await bffRpc<CustomerRow[]>("staff_search_customers", {
        search_text: searchText,
      });
      setResults(
        (data || []).map((item) => ({
          ...item,
          current_progress: Number(item.current_progress || 0),
          completed_cards: Number(item.completed_cards || 0),
          available_rewards: Number(item.available_rewards || 0),
        })),
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Não foi possível buscar os clientes.",
      );
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void searchCustomers(query);
    }, query.trim() ? 220 : 0);
    return () => window.clearTimeout(timer);
  }, [query, searchCustomers]);

  const normalizedDelta = useMemo(() => {
    if (!Number.isFinite(delta)) return 1;
    const rounded = Math.trunc(delta);
    if (rounded === 0) return 1;
    return Math.max(-50, Math.min(50, rounded));
  }, [delta]);

  const applyAdjustment = async () => {
    if (!selected || busy) return;
    if (reason.trim().length < 3) {
      setNotice("Informe um motivo para manter a auditoria completa.");
      return;
    }

    setBusy(true);
    setNotice("");
    const operationKey = `manual-loyalty:${selected.profile_id}:${crypto.randomUUID()}`;
    try {
      const result = await bffRpc<AdjustmentResult>(
        "staff_adjust_loyalty_stamps",
        {
          target_account_id: selected.account_id,
          target_profile_id: selected.profile_id,
          stamps_delta: normalizedDelta,
          adjustment_reason: reason.trim(),
          operation_key: operationKey,
        },
      );
      const next: CustomerRow = {
        ...selected,
        current_progress: Number(result.progress || 0),
        completed_cards: Number(result.completed_cards || 0),
        available_rewards: Math.max(
          0,
          selected.available_rewards
            + Number(result.new_rewards || 0)
            - Number(result.reversed_rewards || 0),
        ),
      };
      setSelected(next);
      setResults((current) =>
        current.map((item) =>
          item.profile_id === next.profile_id ? next : item,
        ),
      );
      setNotice(
        `${normalizedDelta > 0 ? "+" : ""}${normalizedDelta} carimbo(s) aplicado(s) a ${selected.full_name}.`,
      );
      setDelta(1);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Não foi possível ajustar os carimbos.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="quick-loyalty" aria-label="Fidelidade rápida">
      <header className="quick-loyalty-heading">
        <div>
          <small>Atendimento sem depender de venda registrada</small>
          <h2>Carimbos rápidos</h2>
          <p>Busque o cliente, escolha a quantidade e aplique. O banco registra operador, horário, motivo e idempotência.</p>
        </div>
        <ShieldCheck aria-hidden="true" />
      </header>

      {notice ? (
        <p className="quick-loyalty-notice" role="status">
          {notice}
        </p>
      ) : null}

      <div className="quick-loyalty-layout">
        <section className="quick-loyalty-search-card">
          <label>
            Buscar cliente
            <span className="quick-loyalty-search-input">
              <Search />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nome, WhatsApp ou e-mail"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => void searchCustomers()}
                disabled={loading}
                aria-label="Atualizar busca"
              >
                <RefreshCw />
              </button>
            </span>
          </label>

          <div className="quick-loyalty-results" aria-busy={loading}>
            {loading ? <p>Buscando clientes…</p> : null}
            {!loading && !results.length ? (
              <p>Nenhum cliente encontrado.</p>
            ) : null}
            {results.map((customer) => (
              <button
                type="button"
                key={customer.profile_id}
                className={
                  selected?.profile_id === customer.profile_id ? "active" : ""
                }
                onClick={() => {
                  setSelected(customer);
                  setNotice("");
                }}
              >
                <UserRound />
                <span>
                  <strong>{customer.full_name}</strong>
                  <small>{maskPhone(customer.phone_e164)}</small>
                </span>
                <b>{customer.current_progress}/14</b>
              </button>
            ))}
          </div>
        </section>

        <section className="quick-loyalty-adjust-card">
          {!selected ? (
            <div className="quick-loyalty-empty">
              <Heart />
              <strong>Selecione um cliente</strong>
              <span>Os clientes recentes já aparecem ao abrir a tela.</span>
            </div>
          ) : (
            <>
              <header>
                <div>
                  <small>Cliente selecionado</small>
                  <h3>{selected.full_name}</h3>
                  <p>{maskPhone(selected.phone_e164)}</p>
                </div>
                <span>
                  <strong>{selected.current_progress}</strong>
                  <small>de 14</small>
                </span>
              </header>

              <div className="quick-loyalty-metrics">
                <span>
                  <small>Cartões completos</small>
                  <strong>{selected.completed_cards}</strong>
                </span>
                <span>
                  <small>Prêmios disponíveis</small>
                  <strong>{selected.available_rewards}</strong>
                </span>
              </div>

              <div className="quick-loyalty-deltas" aria-label="Quantidade de carimbos">
                {[1, 2, 3].map((value) => (
                  <button
                    type="button"
                    key={`plus-${value}`}
                    className={normalizedDelta === value ? "active positive" : "positive"}
                    onClick={() => setDelta(value)}
                  >
                    <Plus /> {value}
                  </button>
                ))}
                {[-1, -2, -3].map((value) => (
                  <button
                    type="button"
                    key={`minus-${value}`}
                    className={normalizedDelta === value ? "active negative" : "negative"}
                    onClick={() => setDelta(value)}
                  >
                    <Minus /> {Math.abs(value)}
                  </button>
                ))}
              </div>

              <label className="quick-loyalty-custom">
                Quantidade livre
                <input
                  type="number"
                  inputMode="numeric"
                  min="-50"
                  max="50"
                  value={delta}
                  onChange={(event) => setDelta(Number(event.target.value))}
                />
              </label>

              <div className="quick-loyalty-reasons">
                <small>Motivo rápido</small>
                <div>
                  {quickReasons.map((item) => (
                    <button
                      type="button"
                      key={item}
                      className={reason === item ? "active" : ""}
                      onClick={() => setReason(item)}
                    >
                      {reason === item ? <Check /> : null}
                      {item}
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
                className={`quick-loyalty-submit ${normalizedDelta > 0 ? "positive" : "negative"}`}
                onClick={() => void applyAdjustment()}
                disabled={busy}
              >
                {busy
                  ? "Aplicando…"
                  : `${normalizedDelta > 0 ? "+" : ""}${normalizedDelta} carimbo(s) agora`}
              </button>
            </>
          )}
        </section>
      </div>
    </section>
  );
}
