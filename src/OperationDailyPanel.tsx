import { useCallback, useEffect, useState } from "react";
import PainelDoDia from "./PainelDoDia";
import type { EstadoDoDia } from "./painel-do-dia";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date());
const empty = (): EstadoDoDia => ({ data: today(), lojaAberta: true, sabores: [], pedidos: [], avisosPendentes: 0 });
const status = (value: string) =>
  value === "awaiting_confirmation" ? "novo" : value === "reserved" || value === "preparing" ? "separado" : value === "completed" ? "retirado" : value === "cancelled" || value === "expired" ? "cancelado" : "pago";

export default function OperationDailyPanel({ onOrders, onEmptyDay }: { onOrders: () => void; onEmptyDay: () => void }) {
  const [state, setState] = useState<EstadoDoDia>(empty);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setNotice("");
    const response = await fetch("/api/operation-daily-panel", { credentials: "same-origin" });
    const payload = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) { setNotice(payload.error || "Não foi possível carregar o painel."); return; }
    const stock = new Map<string, { quantity_available?: number | null; quantity_reserved?: number | null }>((payload.availability || []).map((row: any) => [row.flavor_id, row]));
    setState({
      data: payload.date || today(), lojaAberta: true, avisosPendentes: payload.pendingNotifications || 0,
      sabores: (payload.menu || []).map((row: any) => {
        const current = stock.get(row.flavor_id);
        return { flavorId: row.flavor_id, nome: row.flavors?.name || "Sabor", planejado: Number(row.quantity_planned || 0), liberado: Number(current?.quantity_available || row.quantity_released || 0), vendido: Number(current?.quantity_reserved || 0), preco: Number(row.flavors?.base_price || 0) };
      }),
      pedidos: (payload.orders || []).map((row: any) => ({ id: row.id, numero: row.order_number, cliente: row.customer_name, fatias: (row.instant_order_items || []).reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0), total: Number(row.total || 0), criadoEm: row.created_at, retiradaEm: null, status: status(row.status) })),
    });
  }, []);
  useEffect(() => { void load(); }, [load]);
  const action = async (key: string) => {
    if (key === "pedidos-novos") return onOrders();
    if (key === "dia-vazio") return onEmptyDay();
    if (key !== "liberar-producao") return;
    const csrf = document.cookie.split("; ").find((entry) => entry.startsWith("__Host-adoce-csrf="))?.split("=")[1] || "";
    const released = await fetch("/api/operation-daily-panel", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-CSRF-Token": decodeURIComponent(csrf) }, body: "{}" });
    if (!released.ok) { const payload = await released.json().catch(() => ({})); return setNotice(payload.error || "Não foi possível liberar a produção."); }
    await load();
  };
  return <><PainelDoDia estado={state} carregando={loading} onAtualizar={() => void load()} onAcao={(key) => void action(key)} />{notice ? <p role="status">{notice}</p> : null}</>;
}
