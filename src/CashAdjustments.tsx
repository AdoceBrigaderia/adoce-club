import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, CakeSlice, X } from "lucide-react";
import { requireSupabase } from "./lib/supabase";

// Lançamentos do caixa fora das vendas (pedido de 24/09/2026):
// - Sangria: dinheiro retirado da gaveta (ex.: levar ao cofre).
// - Suprimento: dinheiro colocado na gaveta (ex.: reforço de troco).
// - Perda: fatias descartadas (caiu, estragou) — baixa o estoque e entra no relatório.
type Kind = "withdrawal" | "supply" | "loss";
const titles: Record<Kind, string> = { withdrawal: "Sangria (retirar dinheiro)", supply: "Suprimento (colocar dinheiro)", loss: "Perda de fatias" };

export default function CashAdjustments({ sessionId, flavors, onChanged }: { sessionId?: string; flavors: Array<{ id: string; name: string; remaining: number }>; onChanged: () => void }) {
  const [kind, setKind] = useState<Kind | null>(null);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [flavorId, setFlavorId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [operationKey, setOperationKey] = useState(() => crypto.randomUUID());

  const open = (next: Kind) => { setKind(next); setAmount(""); setNotes(""); setFlavorId(flavors[0]?.id || ""); setQuantity("1"); setMessage(""); setOperationKey(crypto.randomUUID()); };
  const close = () => { if (!busy) setKind(null); };

  const save = async () => {
    if (!sessionId || !kind) return;
    setBusy(true); setMessage("");
    try {
      if (kind === "loss") {
        const qty = Number(quantity);
        if (!flavorId || !Number.isInteger(qty) || qty < 1) throw new Error("Escolha o sabor e a quantidade.");
        if (notes.trim().length < 3) throw new Error("Informe o motivo da perda.");
        const { error } = await requireSupabase().rpc("staff_record_slice_loss", { target_session_id: sessionId, target_flavor_id: flavorId, requested_quantity: qty, requested_reason: notes.trim() });
        if (error) throw error;
      } else {
        const value = Number(amount.replace(/\./g, "").replace(",", "."));
        if (!Number.isFinite(value) || value <= 0) throw new Error("Informe o valor.");
        if (notes.trim().length < 3) throw new Error("Informe o motivo.");
        const { error } = await requireSupabase().rpc("staff_record_cash_movement_v2", {
          requested_operation_key: operationKey, target_session_id: sessionId, movement_kind: kind,
          requested_payment_method: "cash", requested_amount: value, next_notes: notes.trim(), target_order_id: null,
        });
        if (error) throw error;
      }
      setKind(null);
      onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível registrar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="cash-session-actions cash-adjustments">
        <button type="button" disabled={!sessionId} onClick={() => open("withdrawal")}><ArrowUpFromLine /> Sangria</button>
        <button type="button" disabled={!sessionId} onClick={() => open("supply")}><ArrowDownToLine /> Suprimento</button>
        <button type="button" disabled={!sessionId || !flavors.length} onClick={() => open("loss")}><CakeSlice /> Perda de fatias</button>
      </div>
      {kind ? (
        <div className="cash-modal-backdrop">
          <div className="cash-modal" role="dialog" aria-modal="true" aria-labelledby="cash-adjust-title">
            <button type="button" className="cash-modal-close" onClick={close} aria-label="Fechar"><X /></button>
            <h3 id="cash-adjust-title">{titles[kind]}</h3>
            {kind === "loss" ? (
              <>
                <label>Sabor<select value={flavorId} onChange={(event) => setFlavorId(event.target.value)}>{flavors.map((flavor) => <option key={flavor.id} value={flavor.id}>{flavor.name} · {flavor.remaining} livre(s)</option>)}</select></label>
                <label>Quantidade de fatias<input inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value.replace(/\D/g, ""))} /></label>
                <label>Motivo<input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex.: fatia caiu no balcão" /></label>
                <p>A perda baixa o estoque de hoje e aparece no fechamento e no relatório de sabores.</p>
              </>
            ) : (
              <>
                <label>Valor em dinheiro<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Ex.: 100,00" /></label>
                <label>Motivo<input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={kind === "withdrawal" ? "Ex.: dinheiro levado ao cofre" : "Ex.: reforço de troco"} /></label>
                <p>{kind === "withdrawal" ? "O valor sai do dinheiro esperado na gaveta." : "O valor entra no dinheiro esperado na gaveta."}</p>
              </>
            )}
            {message ? <p role="alert">{message}</p> : null}
            <button type="button" onClick={() => void save()} disabled={busy}>{busy ? "Registrando…" : "Registrar"}</button>
          </div>
        </div>
      ) : null}
    </>
  );
}
