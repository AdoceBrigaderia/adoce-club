import { useCallback, useEffect, useState } from "react";
import { Check, Clock3, Nfc, Plus, RefreshCw, Smartphone } from "lucide-react";
import { bffRpc } from "./services/bff-rpc";
import "./operation-customer-checkins.css";

type CheckInRow = {
  checkin_id: string;
  profile_id: string;
  account_id: string;
  store_id: string;
  register_id: string | null;
  full_name: string;
  phone_e164: string | null;
  member_code: string;
  created_at: string;
  expires_at: string;
};

const maskPhone = (value: string | null) => {
  const digits = (value || "").replace(/\D/g, "").replace(/^55/, "");
  if (digits.length < 10) return value || "Sem telefone";
  return `(${digits.slice(0, 2)}) ${digits.slice(2, -4).replace(/.(?=.{3})/g, "•")}‑${digits.slice(-4)}`;
};

export default function OperationCustomerCheckIns() {
  const [rows, setRows] = useState<CheckInRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await bffRpc<CheckInRow[]>("staff_list_active_customer_checkins", {
        target_store_id: null,
      });
      setRows(data || []);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível atualizar os check-ins.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 3500);
    return () => window.clearInterval(timer);
  }, [load]);

  const apply = async (row: CheckInRow, quantity: number) => {
    setBusyId(row.checkin_id);
    setNotice("");
    try {
      await bffRpc("staff_apply_customer_checkin_stamps", {
        checkin_id: row.checkin_id,
        stamps_delta: quantity,
        adjustment_reason: "Check-in NFC ou QR no atendimento",
        operation_key: `checkin-loyalty:${row.checkin_id}:${crypto.randomUUID()}`,
      });
      setRows((current) => current.filter((item) => item.checkin_id !== row.checkin_id));
      setNotice(`+${quantity} carimbo(s) aplicado(s) a ${row.full_name}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível aplicar os carimbos.");
      await load();
    } finally {
      setBusyId("");
    }
  };

  const tagUrl = `${window.location.origin}/#check-in?loja=passare&caixa=principal`;

  return (
    <section className="operation-checkins" aria-label="Check-ins por NFC e QR">
      <header>
        <div>
          <small>Cliente encostou o celular ou leu o QR</small>
          <h2>Check-ins no caixa</h2>
          <p>O cliente aparece aqui por dois minutos. Toque na quantidade e o check-in já é encerrado.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading}>
          <RefreshCw /> Atualizar
        </button>
      </header>

      {notice ? <p className="operation-checkins-notice" role="status"><Check /> {notice}</p> : null}

      <div className="operation-checkins-tag">
        <Nfc />
        <span>
          <strong>Link para gravar na tag NFC ou imprimir como QR</strong>
          <small>{tagUrl}</small>
        </span>
        <button type="button" onClick={() => void navigator.clipboard.writeText(tagUrl)}>
          Copiar link
        </button>
      </div>

      <div className="operation-checkins-list" aria-busy={loading}>
        {loading && !rows.length ? <p>Atualizando check-ins…</p> : null}
        {!loading && !rows.length ? (
          <div className="operation-checkins-empty">
            <Smartphone />
            <strong>Nenhum cliente aguardando</strong>
            <span>Quando alguém encostar o celular na tag, aparecerá aqui automaticamente.</span>
          </div>
        ) : null}
        {rows.map((row) => {
          const seconds = Math.max(0, Math.ceil((Date.parse(row.expires_at) - Date.now()) / 1000));
          const busy = busyId === row.checkin_id;
          return (
            <article key={row.checkin_id}>
              <div className="operation-checkins-customer">
                <span className="operation-checkins-avatar">{row.full_name.trim().charAt(0).toUpperCase()}</span>
                <span>
                  <strong>{row.full_name}</strong>
                  <small>{maskPhone(row.phone_e164)} · {row.member_code}</small>
                </span>
                <b><Clock3 /> {seconds}s</b>
              </div>
              <div className="operation-checkins-actions">
                {[1, 2, 3].map((quantity) => (
                  <button
                    type="button"
                    key={quantity}
                    disabled={busy}
                    onClick={() => void apply(row, quantity)}
                  >
                    <Plus /> {quantity} carimbo{quantity > 1 ? "s" : ""}
                  </button>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
