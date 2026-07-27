export type PublicServiceRequestInput = {
  requested_product_id: string;
  requested_customer_name: string;
  requested_customer_phone: string;
  requested_customer_email: string | null;
  requested_quantity: number;
  requested_start: string;
  requested_end: string;
  requested_location?: string;
  requested_selections?: Record<string, unknown>;
  requested_notes?: string;
};

export type PublicServiceRequestResult = {
  accepted: boolean;
  request_id?: string;
  request_number?: string;
  expires_at?: string;
  conflict?: string | null;
  competing_prebooks?: number;
  idempotent?: boolean;
  message: string;
};

type Envelope = {
  data?: PublicServiceRequestResult;
  error?: string;
  code?: string;
};

async function parse(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as Envelope;
  if (!response.ok || !payload.data) {
    const error = new Error(
      payload.error || "Não foi possível registrar a pré-reserva agora.",
    ) as Error & { code?: string; status?: number };
    error.code = payload.code;
    error.status = response.status;
    throw error;
  }
  return payload.data;
}

async function send(
  input: PublicServiceRequestInput,
  operationKey: string,
): Promise<Response> {
  return fetch("/api/public-service-request", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      operation_key: operationKey,
      ...input,
    }),
  });
}

export async function submitPublicServiceRequest(
  input: PublicServiceRequestInput,
): Promise<PublicServiceRequestResult> {
  const operationKey = crypto.randomUUID();
  const first = await send(input, operationKey);
  if (first.ok || ![502, 503, 504].includes(first.status)) return parse(first);

  // Uma repetição usa a mesma chave. O banco devolve a solicitação já criada
  // em vez de duplicar a pré-reserva quando a primeira resposta se perde.
  return parse(await send(input, operationKey));
}
