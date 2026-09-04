import { useState } from "react";
import { PrinterCheck } from "lucide-react";
import { requireSupabase } from "./lib/supabase";

// Diferente de NativePrinterSettings (só aparece dentro do app do tablet),
// este botão funciona em qualquer navegador: grava um sinal que o tablet já
// está ouvindo pelo mesmo canal em tempo real que ouve pedido novo, e ele
// reage buscando e imprimindo os pedidos ainda não finalizados.
export default function RemotePrintTrigger() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const run = async () => {
    setBusy(true);
    setMessage("");
    try {
      const { error } = await requireSupabase().rpc("server_request_pending_orders_print");
      if (error) throw error;
      setMessage("Comando enviado. Se o tablet estiver ligado e conectado, a impressão começa em poucos segundos.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar o comando agora. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="native-printer-settings" aria-labelledby="remote-print-title">
      <div>
        <PrinterCheck />
        <span>
          <strong id="remote-print-title">Imprimir pedidos pendentes no tablet</strong>
          <small>Funciona daqui, de qualquer aparelho — o tablet imprime o que ainda não tiver ficha</small>
        </span>
      </div>
      {message ? <p role="status" className="native-printer-message">{message}</p> : null}
      <div className="native-printer-actions">
        <button type="button" disabled={busy} onClick={() => void run()}>
          <PrinterCheck /> Mandar imprimir pendentes
        </button>
      </div>
    </section>
  );
}
