import type { PedeJuntoFlavor, PedeJuntoRoom } from "../pede-junto";

export type PedeJuntoAccess = {
  participant: boolean;
  organizer: boolean;
};

type Envelope<T> = { data?: T; error?: string };

function readCookie(name: string) {
  const prefix = `${name}=`;
  const entry = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix));
  if (!entry) return "";
  try {
    return decodeURIComponent(entry.slice(prefix.length));
  } catch {
    return "";
  }
}

async function request<T>(
  action: string,
  body: Record<string, unknown> = {},
  mutate = false,
) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (mutate) {
    const csrf = readCookie("__Host-adoce-group-csrf");
    if (!csrf) throw new Error("Atualize a página e tente novamente.");
    headers["X-Adoce-Group-CSRF"] = csrf;
  }
  const response = await fetch("/api/pede-junto", {
    method: "POST",
    credentials: "same-origin",
    headers,
    body: JSON.stringify({ action, ...body }),
  });
  const payload = (await response.json().catch(() => ({}))) as Envelope<T>;
  if (!response.ok || payload.data === undefined)
    throw new Error(payload.error || "Não foi possível atualizar o Pede Junto.");
  return payload.data;
}

export function loadPedeJuntoCatalog() {
  return request<PedeJuntoFlavor[]>("catalog");
}

export function createPedeJuntoGroup(input: {
  groupName: string;
  organizerName: string;
  organizerPhone: string;
  deliveryAddress: string;
  deliveryReference?: string;
}) {
  return request<{
    public_code: string;
    invitation_token: string;
    room: PedeJuntoRoom;
    access: PedeJuntoAccess;
  }>("create", {
    group_name: input.groupName,
    organizer_name: input.organizerName,
    organizer_phone: input.organizerPhone,
    delivery_address: input.deliveryAddress,
    delivery_reference: input.deliveryReference || null,
  });
}

export function joinPedeJuntoGroup(input: {
  code: string;
  invitationToken: string;
  participantName: string;
  participantPhone: string;
}) {
  return request<{ room: PedeJuntoRoom; access: PedeJuntoAccess }>("join", {
    group_code: input.code,
    invitation_token: input.invitationToken,
    participant_name: input.participantName,
    participant_phone: input.participantPhone,
  });
}

export function loadPedeJuntoRoom(code: string, invitationToken: string) {
  return request<{ room: PedeJuntoRoom; access: PedeJuntoAccess }>("room", {
    group_code: code,
    invitation_token: invitationToken,
  });
}

export function setPedeJuntoSelection(input: {
  code: string;
  flavorId: string;
  quantity: number;
}) {
  return request<{ room: PedeJuntoRoom; access: PedeJuntoAccess }>(
    "select",
    {
      group_code: input.code,
      selected_flavor_id: input.flavorId,
      selected_quantity: input.quantity,
    },
    true,
  );
}

export function submitPedeJuntoGroup(code: string) {
  return request<{
    submitted: boolean;
    conflicts: Array<{
      flavor_name: string;
      requested: number;
      available: number;
    }>;
    room?: PedeJuntoRoom;
  }>("submit", { group_code: code }, true);
}
