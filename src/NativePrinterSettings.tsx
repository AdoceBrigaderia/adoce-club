import { useCallback, useEffect, useState } from "react";
import { Bluetooth, Printer, RefreshCw } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { NativeOperation } from "./lib/native-operation";

type PrinterStatus = { service: string; printer: string; pending: number };

export default function NativePrinterSettings() {
  const [status, setStatus] = useState<PrinterStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const refresh = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;
    setStatus(await NativeOperation.getStatus());
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  if (!Capacitor.isNativePlatform()) return null;

  const run = async (action: "discover" | "test") => {
    setBusy(true); setMessage("");
    try {
      if (action === "discover") {
        await NativeOperation.discoverPrinter();
        setMessage("Procurando a KNUP por até 12 segundos...");
        window.setTimeout(() => void refresh(), 13_000);
      } else {
        await NativeOperation.printTest();
        setMessage("Ficha de teste enviada.");
        window.setTimeout(() => void refresh(), 1_500);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível falar com a impressora.");
    } finally { setBusy(false); }
  };

  return <section className="native-printer-settings" aria-labelledby="native-printer-title">
    <div><Printer /><span><strong id="native-printer-title">Impressora automática</strong><small>KNUP KP-1025 · Bluetooth · pedidos em tempo real</small></span></div>
    <dl>
      <div><dt>Serviço</dt><dd>{status?.service || "verificando"}</dd></div>
      <div><dt>Impressora</dt><dd>{status?.printer || "não configurada"}</dd></div>
      <div><dt>Fila</dt><dd>{status?.pending || 0} pedido(s)</dd></div>
    </dl>
    <p>O aplicativo continua ouvindo novos pedidos com a tela apagada. A notificação “Operação Adoce ativa” deve permanecer visível.</p>
    {message ? <p role="status" className="native-printer-message">{message}</p> : null}
    <div className="native-printer-actions">
      <button type="button" disabled={busy} onClick={() => void run("discover")}><Bluetooth /> Localizar e conectar KNUP</button>
      <button type="button" disabled={busy} onClick={() => void run("test")}><Printer /> Imprimir teste</button>
      <button type="button" disabled={busy} onClick={() => void refresh()} aria-label="Atualizar estado"><RefreshCw /> Atualizar</button>
    </div>
  </section>;
}
