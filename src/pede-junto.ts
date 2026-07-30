export type PedeJuntoItem = {
  id: string;
  flavor_id: string;
  flavor_name: string;
  unit_price: number;
  quantity: number;
  status: "selected" | "reserved" | "unavailable" | "cancelled" | "paid";
};

export type PedeJuntoParticipant = {
  id: string;
  name: string;
  status: "active" | "payment_pending" | "paid" | "removed" | "cancelled";
  is_viewer: boolean;
  payment_url: string | null;
  payment_expires_at: string | null;
  items: PedeJuntoItem[];
};

export type PedeJuntoRoom = {
  id: string;
  public_code: string;
  name: string;
  organizer_name: string;
  delivery_address: string;
  delivery_reference: string | null;
  minimum_slices: number;
  total_slices: number;
  total_value: number;
  status:
    | "open"
    | "submitted"
    | "confirmed"
    | "awaiting_payment"
    | "preparing"
    | "ready"
    | "completed"
    | "cancelled"
    | "expired";
  closes_at: string;
  free_delivery: boolean;
  participants: PedeJuntoParticipant[];
};

export type PedeJuntoFlavor = {
  id: string;
  name: string;
  image_path: string | null;
  base_price: number;
  status: string;
  quantity_available: number | null;
  quantity_reserved: number;
};

export function progressCopy(total: number, minimum = 5) {
  if (total < minimum) {
    const missing = minimum - total;
    return {
      title: `${total} de ${minimum} fatias`,
      message: `Falta${missing === 1 ? "" : "m"} só ${missing} para liberar a entrega grátis.`,
      tone: "building" as const,
    };
  }
  if (total < 10) {
    return {
      title: `${total} fatias no grupo`,
      message: "Entrega grátis liberada — o grupo continua aberto!",
      tone: "unlocked" as const,
    };
  }
  return {
    title: `${total} fatias no grupo`,
    message: "Grupo gigante! A entrega já é grátis e ainda cabe mais gente.",
    tone: "celebration" as const,
  };
}

export function roomProgressCopy(room: PedeJuntoRoom) {
  if (room.status === "open") {
    return progressCopy(room.total_slices, room.minimum_slices);
  }
  if (room.status === "completed") {
    return {
      title: `${room.total_slices} fatias entregues`,
      message: "Pedido concluído — este grupo está encerrado.",
      tone: "celebration" as const,
    };
  }
  if (room.status === "cancelled") {
    return {
      title: `${room.total_slices} fatias registradas`,
      message: "Este pedido foi cancelado. Para pedir novamente, abra um novo grupo.",
      tone: "building" as const,
    };
  }
  if (room.status === "expired") {
    return {
      title: `${room.total_slices} fatias registradas`,
      message: "O prazo terminou. Para pedir novamente, abra um novo grupo.",
      tone: "building" as const,
    };
  }
  return {
    title: `${room.total_slices} fatias no pedido`,
    message: "O grupo foi encerrado e este pedido está sendo cuidado pela Adoce.",
    tone: room.free_delivery ? ("unlocked" as const) : ("building" as const),
  };
}

export function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function parsePedeJuntoHash(hash = window.location.hash) {
  const query = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  const params = new URLSearchParams(query);
  return {
    code: params.get("grupo") || "",
    invitationToken: params.get("convite") || "",
  };
}

export function pedeJuntoInviteUrl(code: string, invitationToken: string) {
  const url = new URL(window.location.origin + window.location.pathname);
  url.hash = `pede-junto?grupo=${encodeURIComponent(code)}&convite=${encodeURIComponent(invitationToken)}`;
  return url.toString();
}

export function buildPedeJuntoWhatsAppMessage(
  room: PedeJuntoRoom,
  inviteUrl: string,
) {
  const progress = room.free_delivery
    ? `Já temos ${room.total_slices} fatias e a entrega grátis está liberada — mas o grupo continua aberto!`
    : `Estamos com ${room.total_slices} de ${room.minimum_slices} fatias para liberar a entrega grátis.`;
  return [
    "Bora de fatia? 🍰",
    progress,
    "Cada um escolhe e paga o seu. Todo mundo recebe junto no mesmo endereço.",
    `Entre no grupo “${room.name}”:`,
    inviteUrl,
  ].join("\n\n");
}

export const pedeJuntoStatuses: Record<PedeJuntoRoom["status"], string> = {
  open: "Grupo aberto",
  submitted: "Enviado para a Adoce",
  confirmed: "Pedido confirmado",
  awaiting_payment: "Aguardando pagamentos",
  preparing: "Em preparação",
  ready: "Pronto para sair",
  completed: "Entregue",
  cancelled: "Cancelado",
  expired: "Prazo encerrado",
};
