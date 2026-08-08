import { useCallback, useEffect, useState } from "react";
import PainelDoDia from "./PainelDoDia";
import type { EstadoDoDia } from "./painel-do-dia";
import { requireSupabase } from "./lib/supabase";

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
    const date = today(); const db = requireSupabase();
    const [menu, availability, orders, notifications] = await Promise.all([
      db.from("weekly_service_menu").select("id,flavor_id,quantity_planned,quantity_released,flavors(name,base_price)").eq("service_date", date).eq("channel_slug", "online_orders"),
      db.from("flavor_availability").select("flavor_id,quantity_available,quantity_reserved").eq("service_date", date),
      db.from("instant_orders").select("id,order_number,customer_name,total,created_at,status,instant_order_items(quantity)").gte("created_at", `${date}T00:00:00-03:00`).lt("created_at", `${date}T23:59:59-03:00`),
      db.from("operation_notifications").select("id", { count: "exact", head: true }).eq("push_status", "pending"),
    ]);
    setLoading(false);
    const error = menu.error || availability.error || orders.error || notifications.error;
    if (error) { setNotice(error.message); return; }
    const stock = new Map((availability.data || []).map((row) => [row.flavor_id, row]));
    setState({
      data: date, lojaAberta: true, avisosPendentes: notifications.count || 0,
      sabores: (menu.data || []).map((row: any) => {
        const current = stock.get(row.flavor_id);
        return { flavorId: row.flavor_id, nome: row.flavors?.name || "Sabor", planejado: Number(row.quantity_planned || 0), liberado: Number(current?.quantity_available || row.quantity_released || 0), vendido: Number(current?.quantity_reserved || 0), preco: Number(row.flavors?.base_price || 0) };
      }),
      pedidos: (orders.data || []).map((row: any) => ({ id: row.id, numero: row.order_number, cliente: row.customer_name, fatias: (row.instant_order_items || []).reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0), total: Number(row.total || 0), criadoEm: row.created_at, retiradaEm: null, status: status(row.status) })),
    });
  }, []);
  useEffect(() => { void load(); }, [load]);
  const action = async (key: string) => {
    if (key === "pedidos-novos") return onOrders();
    if (key === "dia-vazio") return onEmptyDay();
    if (key !== "liberar-producao") return;
    const db = requireSupabase(); const date = today();
    const { data, error } = await db.from("weekly_service_menu").select("id,quantity_planned,quantity_released").eq("service_date", date).eq("channel_slug", "online_orders");
    if (error) return setNotice(error.message);
    const ids = (data || []).filter((row) => Number(row.quantity_planned || 0) > Number(row.quantity_released || 0)).map((row) => row.id);
    if (!ids.length) return void load();
    const released = await db.rpc("staff_release_weekly_production", { release_date: date, release_item_ids: ids });
    if (released.error) return setNotice(released.error.message);
    await load();
  };
  return <><PainelDoDia estado={state} carregando={loading} onAtualizar={() => void load()} onAcao={(key) => void action(key)} />{notice ? <p role="status">{notice}</p> : null}</>;
}
