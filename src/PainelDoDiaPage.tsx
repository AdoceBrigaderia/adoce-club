import { useCallback, useEffect, useState } from "react";
import PainelDoDia from "./PainelDoDia";
import type { EstadoDoDia, PedidoDoDia, SaborDoDia } from "./painel-do-dia";
import { requireSupabase } from "./lib/supabase";
import { serviceState, type BusinessHour, type BusinessHourException } from "./AdoceHoje";

const todayInFortaleza = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date());

const instantOrderStatusMap: Record<string, PedidoDoDia["status"]> = {
  awaiting_confirmation: "novo",
  reserved: "separado",
  preparing: "separado",
  awaiting_payment: "separado",
  paid: "pago",
  ready: "pago",
  completed: "retirado",
  cancelled: "cancelado",
  expired: "cancelado",
};

// Religa PainelDoDia.tsx (decisao "Religar" da auditoria) com dados reais.
// Por decisao de produto, NAO substitui OperationDashboard.tsx como porta de
// entrada padrao - fica acessivel por /operacao/painel-do-dia enquanto o
// time confere se cobre o caso de uso antes de uma troca definitiva.
//
// avisosPendentes fica fixo em 0: nao ha hoje nenhuma consulta de
// operation_notifications liberada para o papel de staff (nem RPC, nem
// grant direto) - documentado aqui em vez de inventar um numero.
export default function PainelDoDiaPage() {
  const [estado, setEstado] = useState<EstadoDoDia | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    const supabase = requireSupabase();
    const hoje = todayInFortaleza();
    const [flavorsResult, availabilityResult, plannedResult, ordersResult, itemsResult, channelsResult, hoursResult, exceptionsResult] =
      await Promise.all([
        supabase.from("flavors").select("id,name,base_price").eq("active", true),
        supabase.from("flavor_availability").select("flavor_id,quantity_available,quantity_reserved,status").eq("service_date", hoje),
        supabase.from("weekly_service_menu").select("flavor_id,quantity_planned").eq("service_date", hoje),
        supabase.from("instant_orders").select("id,order_number,customer_name,total,created_at,reserved_until,status")
          .gte("created_at", `${hoje}T00:00:00-03:00`).lte("created_at", `${hoje}T23:59:59-03:00`),
        supabase.from("instant_order_items").select("order_id,quantity"),
        supabase.from("store_channels").select("slug,status"),
        supabase.from("business_hours").select("channel_slug,weekday,opens_at,closes_at,active,note"),
        supabase.from("business_hour_exceptions").select("channel_slug,service_date,closed,opens_at,closes_at,message").eq("service_date", hoje),
      ]);
    const firstError =
      flavorsResult.error || availabilityResult.error || plannedResult.error ||
      ordersResult.error || itemsResult.error || channelsResult.error || hoursResult.error || exceptionsResult.error;
    setCarregando(false);
    if (firstError) { setErro("Não foi possível carregar o painel agora."); return; }
    setErro("");

    const planejadoPorSabor = new Map<string, number>();
    for (const row of plannedResult.data || []) planejadoPorSabor.set(row.flavor_id, (planejadoPorSabor.get(row.flavor_id) || 0) + Number(row.quantity_planned || 0));
    const disponibilidadePorSabor = new Map<string, { liberado: number; vendido: number }>();
    for (const row of availabilityResult.data || []) {
      if (row.status === "unavailable") continue;
      disponibilidadePorSabor.set(row.flavor_id, {
        liberado: Number(row.quantity_available || 0),
        vendido: Number(row.quantity_reserved || 0),
      });
    }
    const sabores: SaborDoDia[] = (flavorsResult.data || [])
      .filter((flavor) => planejadoPorSabor.has(flavor.id) || disponibilidadePorSabor.has(flavor.id))
      .map((flavor) => {
        const disponibilidade = disponibilidadePorSabor.get(flavor.id);
        return {
          flavorId: flavor.id,
          nome: flavor.name,
          planejado: planejadoPorSabor.get(flavor.id) || 0,
          liberado: disponibilidade?.liberado || 0,
          vendido: disponibilidade?.vendido || 0,
          preco: Number(flavor.base_price || 0),
        };
      });

    const fatiasPorPedido = new Map<string, number>();
    for (const item of itemsResult.data || []) fatiasPorPedido.set(item.order_id, (fatiasPorPedido.get(item.order_id) || 0) + Number(item.quantity || 0));
    const pedidos: PedidoDoDia[] = (ordersResult.data || []).map((order) => ({
      id: order.id,
      numero: order.order_number,
      cliente: order.customer_name,
      fatias: fatiasPorPedido.get(order.id) || 0,
      total: Number(order.total || 0),
      criadoEm: order.created_at,
      retiradaEm: order.reserved_until,
      status: instantOrderStatusMap[order.status] || "novo",
    }));

    const inPerson = (channelsResult.data || []).find((channel) => channel.slug === "in_person");
    const stallState = serviceState("stall", (hoursResult.data || []) as BusinessHour[], (exceptionsResult.data || []) as BusinessHourException[]);
    const lojaAberta = inPerson?.status === "paused" ? false : stallState.open;

    setEstado({ data: hoje, lojaAberta, sabores, pedidos, avisosPendentes: 0 });
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  if (erro) return <main className="painel-dia"><p role="alert">{erro}</p></main>;
  if (!estado) return <main className="painel-dia"><p>Carregando o painel do dia...</p></main>;
  return <PainelDoDia estado={estado} onAtualizar={() => void carregar()} carregando={carregando} />;
}
