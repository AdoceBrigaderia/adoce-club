import { useEffect, useState } from "react";
import AcompanharPedido from "./AcompanharPedido";
import type { Etapa, Pedido } from "./jornada-do-pedido";
import { useOrderWhatsAppNumber } from "./order-whatsapp";

type OrderResponse = {
  order_number: string;
  status: Etapa;
  payment_status: string;
  total: number;
  reserved_until: string | null;
  pickup_label: string | null;
  pickup_address: string | null;
  items: Array<{ name: string; quantity: number; unit_price: number; status: string }>;
};

const horaCurta = (iso: string | null) => {
  if (!iso) return "";
  const data = new Date(iso);
  return Number.isFinite(data.getTime())
    ? new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Fortaleza" }).format(data)
    : "";
};

const paraPedido = (order: OrderResponse): Pedido => ({
  numero: order.order_number,
  cliente: "",
  telefone: "",
  etapa: order.status,
  itens: order.items.map((item) => ({ sabor: item.name, quantidade: item.quantity, calda: null, presente: false })),
  total: order.total,
  retirada: order.pickup_label
    ? { local: order.pickup_label + (order.pickup_address ? ` — ${order.pickup_address}` : ""), aPartirDe: horaCurta(order.reserved_until) || "combinar" }
    : null,
  pago: order.payment_status === "approved",
});

export default function AcompanharPedidoPage() {
  const params = new URLSearchParams(location.search);
  const orderNumber = (params.get("pedido") || "").trim();
  const token = (params.get("token") || "").trim();
  const whatsapp = useOrderWhatsAppNumber();
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!orderNumber || !token) { setErro("Link incompleto."); setCarregando(false); return; }
    let cancelado = false;
    const carregar = async () => {
      try {
        const resposta = await fetch("/api/pedidos/acompanhar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_number: orderNumber, token }),
        });
        const corpo = await resposta.json();
        if (cancelado) return;
        if (!resposta.ok) { setErro(corpo?.error || "Não foi possível encontrar este pedido."); setOrder(null); }
        else { setOrder(corpo.order as OrderResponse); setErro(""); }
      } catch {
        if (!cancelado) setErro("Sem conexão no momento. Tentando de novo...");
      } finally {
        if (!cancelado) setCarregando(false);
      }
    };
    void carregar();
    const intervalo = window.setInterval(carregar, 20000);
    return () => { cancelado = true; window.clearInterval(intervalo); };
  }, [orderNumber, token]);

  if (carregando) return <main className="acompanha"><p>Carregando seu pedido...</p></main>;
  if (erro || !order) return <main className="acompanha"><p role="alert">{erro || "Pedido não encontrado."}</p></main>;
  return <AcompanharPedido pedido={paraPedido(order)} retiradaEm={order.reserved_until} criadoEm={null} whatsapp={whatsapp} />;
}
