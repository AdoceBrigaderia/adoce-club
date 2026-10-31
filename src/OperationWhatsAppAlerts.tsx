import { useEffect, useState } from "react";
import { MessageCircle, TriangleAlert, X } from "lucide-react";
import { supportRequest } from "./WhatsAppSupportInbox";
import "./operation-whatsapp-alerts.css";

type ThreadRow = { status: string; automation_mode?: string; has_customer_messages?: boolean };
type OrderIssue = { order_id: string; order_number: string; recipient: string; status: string; error?: string | null };

// Resumo de atendimento pro Caixa: só o que exige uma decisão do atendente.
// Avisos automáticos (carimbo de fidelidade, confirmação de pedido já
// entregue com sucesso) nunca aparecem aqui — só clientes de fato
// esperando resposta (amarelo) ou pedidos com aviso que falhou (vermelho).
export default function OperationWhatsAppAlerts({ onOpenInbox }: { onOpenInbox: () => void }) {
  const [waiting, setWaiting] = useState(0);
  const [failed, setFailed] = useState(0);
  const [issues, setIssues] = useState<OrderIssue[]>([]);
  const [open, setOpen] = useState<"waiting" | "failed" | null>(null);

  useEffect(() => {
    const refresh = () => {
      void supportRequest("?view=active").then((payload) => {
        const threads = (payload.threads || []) as ThreadRow[];
        setWaiting(threads.filter((item) => item.status === "waiting" && item.automation_mode !== "bot" && item.has_customer_messages).length);
        setFailed(Number(payload.orderNotificationHealth?.failed || 0));
        setIssues((payload.orderNotificationHealth?.issues || []) as OrderIssue[]);
      }).catch(() => undefined);
    };
    refresh();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    window.addEventListener("adoce-support-updated", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("adoce-support-updated", refresh); };
  }, []);

  if (!waiting && !failed) return <p className="operation-whatsapp-alerts-empty"><MessageCircle /> Nenhum cliente esperando resposta agora.</p>;

  return (
    <div className="operation-whatsapp-alerts">
      {waiting ? <button type="button" className="operation-whatsapp-alert waiting" onClick={() => setOpen("waiting")}>{waiting}</button> : null}
      {failed ? <button type="button" className="operation-whatsapp-alert failed" onClick={() => setOpen("failed")}>{failed}</button> : null}
      <span>{waiting ? `${waiting} cliente(s) esperando resposta` : ""}{waiting && failed ? " · " : ""}{failed ? `${failed} aviso(s) de pedido falharam` : ""}</span>
      {open ? (
        <div className="operation-whatsapp-alert-card" role="dialog" aria-modal="true">
          <button type="button" className="operation-whatsapp-alert-close" aria-label="Fechar" onClick={() => setOpen(null)}><X /></button>
          {open === "waiting" ? <>
            <h4><MessageCircle /> {waiting} cliente(s) esperando resposta</h4>
            <p>São conversas reais, com mensagem do cliente, que ainda não foram respondidas pela equipe.</p>
            <button type="button" className="operation-whatsapp-alert-action" onClick={() => { setOpen(null); onOpenInbox(); }}>Abrir conversas</button>
          </> : <>
            <h4><TriangleAlert /> {failed} aviso(s) de pedido falharam</h4>
            <p>O WhatsApp não confirmou o envio desses avisos nos últimos 7 dias. O pedido pode estar certo, mas o cliente não recebeu a notificação.</p>
            <ul>
              {issues.slice(0, 4).map((issue) => <li key={`${issue.order_id}:${issue.recipient}`}><strong>{issue.order_number}</strong> · {issue.recipient}{issue.error ? ` · ${issue.error}` : ""}</li>)}
            </ul>
            <button type="button" className="operation-whatsapp-alert-action" onClick={() => { setOpen(null); onOpenInbox(); }}>Ver e reenviar</button>
          </>}
        </div>
      ) : null}
    </div>
  );
}
