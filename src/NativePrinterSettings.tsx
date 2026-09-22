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

  const run = async (action: "discover" | "test" | "samples" | "large-sample") => {
    setBusy(true); setMessage("");
    try {
      if (action === "discover") {
        await NativeOperation.discoverPrinter();
        setMessage("Procurando a KNUP por até 12 segundos...");
        window.setTimeout(() => void refresh(), 13_000);
      } else if (action === "test") {
        await NativeOperation.printTest();
        setMessage("Ficha de teste enviada.");
        window.setTimeout(() => void refresh(), 1_500);
      } else if (action === "samples") {
        await NativeOperation.printSamples();
        setMessage("Enviando 3 amostras: simples, retirada e pedido grande...");
        window.setTimeout(() => void refresh(), 4_000);
      } else {
        await NativeOperation.printLargeSample();
        setMessage("Enviando uma amostra grande detalhada...");
        window.setTimeout(() => void refresh(), 3_000);
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
      <button type="button" disabled={busy} onClick={() => void run("samples")}><Printer /> Imprimir 3 amostras</button>
      <button type="button" disabled={busy} onClick={() => void run("large-sample")}><Printer /> Imprimir amostra grande</button>
      <button type="button" disabled={busy} onClick={() => void refresh()} aria-label="Atualizar estado"><RefreshCw /> Atualizar</button>
    </div>
  </section>;
}
