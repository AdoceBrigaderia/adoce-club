import { useCallback, useEffect, useRef, useState } from "react";
import { Clock3, Printer, X } from "lucide-react";
import { requireSupabase } from "./lib/supabase";
import { cashDayAction, fortalezaDateKey } from "./cash-day-cycle";
import "./cash-day-guard.css";
import { closingPrintJobs, type FullClosingReport } from "./lib/cash-reports";
import { queuePrints } from "./lib/print-queue";

// Ciclo diário do caixa (pedido de 24/09/2026):
// - às 23h, na tela do Caixa, pede o fechamento (com opção de adiar 30 min);
// - à meia-noite, com o sistema em uso, fecha sozinho (contado = esperado);
// - caixa esquecido aberto de outro dia é fechado da mesma forma no primeiro acesso.
// Os relatórios de abertura e fechamento são impressos pelo tablet.

type OpenSession = { id: string; opened_at: string };
export const cashChangedEvent = "adoce-cash-changed";
const snoozeKey = (sessionId: string) => `adoce-cash-close-snooze:${sessionId}`;

export default function CashDayGuard({ onCashScreen, onNotice }: { onCashScreen: boolean; onNotice: (message: string) => void }) {
  const [session, setSession] = useState<OpenSession | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [counted, setCounted] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const autoClosing = useRef(false);

  const loadSession = useCallback(async () => {
    const { data } = await requireSupabase()
      .from("cash_sessions")
      .select("id,opened_at")
      .eq("status", "open")
      .order("opened_at", { ascending: true })
      .limit(1);
    const next = ((data || [])[0] as OpenSession | undefined) || null;
    setSession(next);
    return next;
  }, []);

  const autoClose = useCallback(async (target: OpenSession) => {
    if (autoClosing.current) return;
    autoClosing.current = true;
    try {
      const { data: autoReport, error: closeError } = await requireSupabase().rpc("staff_auto_close_cash_with_report", { target_session_id: target.id });
      if (closeError) throw closeError;
      await queuePrints(closingPrintJobs(autoReport as FullClosingReport)).catch(() => undefined);
      setPromptOpen(false);
      onNotice("Caixa fechado automaticamente com o dinheiro contado igual ao esperado. O relatório foi enviado para a impressora.");
      window.dispatchEvent(new Event(cashChangedEvent));
      await loadSession();
    } catch (closeError) {
      onNotice(closeError instanceof Error ? `Não foi possível fechar o caixa automaticamente: ${closeError.message}` : "Não foi possível fechar o caixa automaticamente.");
    } finally {
      autoClosing.current = false;
    }
  }, [loadSession, onNotice]);

  const evaluate = useCallback(async () => {
    const current = await loadSession();
    if (!current) { setPromptOpen(false); return; }
    let snoozedUntil = 0;
    try { snoozedUntil = Number(window.localStorage.getItem(snoozeKey(current.id)) || 0); } catch { snoozedUntil = 0; }
    const action = cashDayAction({ openedAt: current.opened_at, now: new Date(), snoozedUntil });
    if (action === "auto-close") await autoClose(current);
    else if (action === "prompt-close") setPromptOpen(true);
  }, [autoClose, loadSession]);

  useEffect(() => {
    void evaluate();
    const timer = window.setInterval(() => void evaluate(), 30_000);
    const onChanged = () => void loadSession();
    window.addEventListener(cashChangedEvent, onChanged);
    return () => { window.clearInterval(timer); window.removeEventListener(cashChangedEvent, onChanged); };
  }, [evaluate, loadSession]);

  const snooze = () => {
    if (!session) return;
    try { window.localStorage.setItem(snoozeKey(session.id), String(Date.now() + 30 * 60 * 1000)); } catch { /* sem armazenamento: volta a perguntar em 30 s */ }
    setPromptOpen(false);
    onNotice("Fechamento adiado por 30 minutos. À meia-noite o caixa fecha automaticamente.");
  };

  const closeNow = async () => {
    if (!session) return;
    const value = Number(counted.replace(/\./g, "").replace(",", "."));
    if (!counted.trim() || !Number.isFinite(value) || value < 0) { setError("Informe o dinheiro contado na gaveta."); return; }
    setBusy(true); setError("");
    try {
      const { data: closeReport, error: closeError } = await requireSupabase().rpc("staff_close_cash_with_report", { target_session_id: session.id, next_counted_cash: value });
      if (closeError) throw closeError;
      await queuePrints(closingPrintJobs(closeReport as FullClosingReport)).catch(() => undefined);
      setPromptOpen(false); setCounted("");
      onNotice("Caixa fechado. O relatório de fechamento foi enviado para a impressora.");
      window.dispatchEvent(new Event(cashChangedEvent));
      await loadSession();
    } catch (closeError) {
      setError(closeError instanceof Error ? closeError.message : "Não foi possível fechar o caixa.");
    } finally {
      setBusy(false);
    }
  };

  if (!promptOpen || !onCashScreen || !session) return null;
  return (
    <div className="cash-day-backdrop">
      <div className="cash-day-dialog" role="dialog" aria-modal="true" aria-labelledby="cash-day-title">
        <button type="button" className="cash-day-close" onClick={snooze} aria-label="Adiar o fechamento por 30 minutos"><X /></button>
        <Clock3 aria-hidden="true" />
        <h2 id="cash-day-title">Hora de fechar o caixa</h2>
        <p>
          Conte o dinheiro físico da gaveta e informe abaixo. Pix e cartões entram automaticamente no relatório.
          {" "}Se não fechar, o caixa será encerrado automaticamente à meia-noite com o valor esperado.
        </p>
        <label>
          Dinheiro contado na gaveta
          <input inputMode="decimal" autoFocus value={counted} onChange={(event) => setCounted(event.target.value)} placeholder="Ex.: 150,00" />
        </label>
        {error ? <p className="cash-day-error" role="alert">{error}</p> : null}
        <div>
          <button type="button" className="cash-day-secondary" onClick={snooze} disabled={busy}>Adiar 30 min</button>
          <button type="button" className="cash-day-primary" onClick={() => void closeNow()} disabled={busy}>
            <Printer aria-hidden="true" /> {busy ? "Fechando…" : "Fechar e imprimir relatório"}
          </button>
        </div>
        <small>Hoje: {new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: "America/Fortaleza" }).format(new Date(`${fortalezaDateKey(new Date())}T12:00:00`))}</small>
      </div>
    </div>
  );
}
