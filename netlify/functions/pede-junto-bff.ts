import { randomBytes } from "node:crypto";
import {
  parseCookies,
  secureJson,
} from "./_shared/session-security";
import { guardBffCsrf, guardBffRequest } from "./_shared/request-security";
import {
  consumePublicRateLimits,
  ipRateLimitRule,
} from "./_shared/public-rate-limit";

declare const Netlify:
  | { env: { get(name: string): string | undefined } }
  | undefined;

const env = (name: string) =>
  (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) ||
  process.env[name];

const GROUP_ACCESS_COOKIE = "__Host-adoce-group-access";
const GROUP_CSRF_COOKIE = "__Host-adoce-group-csrf";
const GROUP_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GROUP_CODE = /^[A-Z0-9]{6,16}$/;
const TOKEN = /^[a-f0-9]{32,128}$/i;

type JsonObject = Record<string, unknown>;
type GroupAccess = {
  code: string;
  participantToken: string;
  organizerToken?: string;
};

type CreateResult = {
  public_code: string;
  invitation_token: string;
  organizer_token: string;
  participant_token: string;
  room: unknown;
};

type JoinResult = {
  participant_token: string;
  room: unknown;
};

const encode = (value: string) => encodeURIComponent(value);
const cookie = (
  name: string,
  value: string,
  options: { httpOnly: boolean; maxAge?: number },
) =>
  [
    `${name}=${encode(value)}`,
    "Path=/",
    `Max-Age=${Math.max(0, Math.floor(options.maxAge ?? GROUP_MAX_AGE_SECONDS))}`,
    "Secure",
    options.httpOnly ? "HttpOnly" : "",
    "SameSite=Strict",
  ]
    .filter(Boolean)
    .join("; ");

function encodeAccess(access: GroupAccess) {
  return Buffer.from(JSON.stringify(access), "utf8").toString("base64url");
}

function decodeAccess(value: string | undefined): GroupAccess | null {
  if (!value || value.length > 1024) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as GroupAccess;
    const code = String(parsed.code || "").trim().toUpperCase();
    const participantToken = String(parsed.participantToken || "").trim();
    const organizerToken = String(parsed.organizerToken || "").trim();
    if (!GROUP_CODE.test(code) || !TOKEN.test(participantToken)) return null;
    if (organizerToken && !TOKEN.test(organizerToken)) return null;
    return {
      code,
      participantToken,
      ...(organizerToken ? { organizerToken } : {}),
    };
  } catch {
    return null;
  }
}

function generateCsrf() {
  return randomBytes(32).toString("hex");
}

function fixedTimeEqual(left: string, right: string) {
  if (!left || left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1)
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}

function validGroupCsrf(request: Request) {
  const cookies = parseCookies(request);
  const cookieValue = cookies.get(GROUP_CSRF_COOKIE) || "";
  const headerValue = request.headers.get("x-adoce-group-csrf") || "";
  return (
    /^[a-f0-9]{64}$/i.test(cookieValue) &&
    fixedTimeEqual(cookieValue, headerValue)
  );
}

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function digits(value: unknown) {
  return text(value, 32).replace(/\D/g, "");
}

function supabaseHeaders(secretKey: string) {
  return {
    apikey: secretKey,
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function readPayload(response: Response) {
  const raw = await response.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return { message: "Resposta inválida do serviço de dados." };
  }
}

function upstreamMessage(value: unknown, fallback: string) {
  const source = value as { message?: string; error?: string } | null;
  return source?.message || source?.error || fallback;
}

async function rpc(
  supabaseUrl: string,
  secretKey: string,
  name: string,
  params: JsonObject,
) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: supabaseHeaders(secretKey),
    body: JSON.stringify(params),
  });
  const data = await readPayload(response);
  if (!response.ok)
    throw new Error(
      upstreamMessage(data, "Não foi possível atualizar o Pede Junto."),
    );
  return data;
}

async function catalog(supabaseUrl: string, secretKey: string) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const headers = supabaseHeaders(secretKey);
  const [flavorsResponse, availabilityResponse] = await Promise.all([
    fetch(
      `${supabaseUrl}/rest/v1/flavors?select=id,name,image_path,base_price&active=eq.true&order=sort_order.asc`,
      { headers },
    ),
    fetch(
      `${supabaseUrl}/rest/v1/flavor_availability?select=flavor_id,status,quantity_available,quantity_reserved&service_date=eq.${encodeURIComponent(today)}`,
      { headers },
    ),
  ]);
  const flavors = (await readPayload(flavorsResponse)) as JsonObject[] | null;
  const availability = (await readPayload(availabilityResponse)) as
    | JsonObject[]
    | null;
  if (!flavorsResponse.ok || !availabilityResponse.ok)
    throw new Error("Não foi possível carregar os sabores do Pede Junto.");
  const stock = new Map(
    (availability || []).map((entry) => [String(entry.flavor_id), entry]),
  );
  return (flavors || [])
    .map((flavor) => {
      const current = stock.get(String(flavor.id));
      return {
        ...flavor,
        base_price: Number(flavor.base_price || 0),
        status: String(current?.status || "unavailable"),
        quantity_available:
          current?.quantity_available === null
            ? null
            : Number(current?.quantity_available || 0),
        quantity_reserved: Number(current?.quantity_reserved || 0),
      };
    })
    .filter((flavor) =>
      ["available", "last_units", "preorder_only"].includes(flavor.status),
    );
}

function accessCookies(access: GroupAccess) {
  const csrf = generateCsrf();
  return {
    csrf,
    values: [
      cookie(GROUP_ACCESS_COOKIE, encodeAccess(access), { httpOnly: true }),
      cookie(GROUP_CSRF_COOKIE, csrf, { httpOnly: false }),
    ],
  };
}

function publicAccess(access: GroupAccess | null, code: string) {
  const current = access?.code === code ? access : null;
  return {
    participant: Boolean(current?.participantToken),
    organizer: Boolean(current?.organizerToken),
  };
}

export default async (request: Request) => {
  const requestRejection = guardBffRequest(request, {
    methods: ["POST"],
    configuredSiteUrl: env("SITE_URL"),
  });
  if (requestRejection) return requestRejection;

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 16_384)
    return secureJson({ error: "Solicitação maior que o permitido." }, 413);

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const secretKey =
    env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !secretKey)
    return secureJson({ error: "Pede Junto temporariamente indisponível." }, 503);

  const body = (await request.json().catch(() => ({}))) as JsonObject;
  const action = text(body.action, 32);
  const cookies = parseCookies(request);
  const storedAccess = decodeAccess(cookies.get(GROUP_ACCESS_COOKIE));

  try {
    if (action === "catalog")
      return secureJson({ data: await catalog(supabaseUrl, secretKey) });

    if (action === "create") {
      const operationKey = text(body.requested_operation_key, 36);
      const groupName = text(body.group_name, 60);
      const organizerName = text(body.organizer_name, 80);
      const organizerPhone = digits(body.organizer_phone);
      const deliveryAddress = text(body.delivery_address, 240);
      const deliveryReference = text(body.delivery_reference, 160);
      if (
        groupName.length < 3 ||
        organizerName.length < 2 ||
        organizerPhone.length < 10 ||
        deliveryAddress.length < 8 ||
        !UUID.test(operationKey)
      )
        return secureJson({ error: "Revise os dados do novo grupo." }, 400);
      const rateLimit = await consumePublicRateLimits({
        supabaseUrl,
        secretKey,
        pepper:
          env("PUBLIC_RATE_LIMIT_PEPPER") ||
          env("WHATSAPP_OTP_PEPPER") ||
          secretKey,
        rules: [
          ipRateLimitRule(request, "pede-junto-create:ip", 3600, 12),
          {
            bucket: "pede-junto-create:phone",
            subject: `phone:${organizerPhone}`,
            windowSeconds: 6 * 3600,
            maxRequests: 4,
          },
        ],
      });
      if (!rateLimit.allowed)
        return secureJson(
          {
            error: rateLimit.failed
              ? "Pede Junto temporariamente indisponível."
              : "Muitas tentativas. Aguarde antes de criar outro grupo.",
            code: rateLimit.failed ? "rate_limit_unavailable" : "rate_limited",
            retry_after_seconds: rateLimit.retryAfterSeconds,
          },
          rateLimit.failed ? 503 : 429,
        );
      const result = (await rpc(
        supabaseUrl,
        secretKey,
        "create_pede_junto_group_v2",
        {
          requested_operation_key: operationKey,
          group_name: groupName,
          organizer_name: organizerName,
          organizer_phone: organizerPhone,
          delivery_address: deliveryAddress,
          delivery_reference: deliveryReference || null,
        },
      )) as CreateResult;
      if (
        !GROUP_CODE.test(result.public_code) ||
        !TOKEN.test(result.invitation_token) ||
        !TOKEN.test(result.participant_token) ||
        !TOKEN.test(result.organizer_token)
      )
        throw new Error("O grupo foi criado com uma resposta inválida.");
      const prepared = accessCookies({
        code: result.public_code,
        participantToken: result.participant_token,
        organizerToken: result.organizer_token,
      });
      return secureJson(
        {
          data: {
            public_code: result.public_code,
            invitation_token: result.invitation_token,
            room: result.room,
            access: { participant: true, organizer: true },
          },
        },
        200,
        prepared.values,
      );
    }

    const code = text(body.group_code, 16).toUpperCase();
    const invitationToken = text(body.invitation_token, 128);
    if (!GROUP_CODE.test(code))
      return secureJson({ error: "Código do grupo inválido." }, 400);

    if (action === "join") {
      const operationKey = text(body.requested_operation_key, 36);
      const participantName = text(body.participant_name, 80);
      const participantPhone = digits(body.participant_phone);
      if (
        !TOKEN.test(invitationToken) ||
        participantName.length < 2 ||
        participantPhone.length < 10 ||
        !UUID.test(operationKey)
      )
        return secureJson({ error: "Revise os dados para entrar no grupo." }, 400);
      const rateLimit = await consumePublicRateLimits({
        supabaseUrl,
        secretKey,
        pepper:
          env("PUBLIC_RATE_LIMIT_PEPPER") ||
          env("WHATSAPP_OTP_PEPPER") ||
          secretKey,
        rules: [
          ipRateLimitRule(request, "pede-junto-join:ip", 3600, 40),
          {
            bucket: "pede-junto-join:phone",
            subject: `phone:${participantPhone}`,
            windowSeconds: 3600,
            maxRequests: 10,
          },
        ],
      });
      if (!rateLimit.allowed)
        return secureJson(
          {
            error: rateLimit.failed
              ? "Pede Junto temporariamente indisponível."
              : "Muitas tentativas. Aguarde antes de entrar novamente.",
            code: rateLimit.failed ? "rate_limit_unavailable" : "rate_limited",
            retry_after_seconds: rateLimit.retryAfterSeconds,
          },
          rateLimit.failed ? 503 : 429,
        );
      const result = (await rpc(
        supabaseUrl,
        secretKey,
        "join_pede_junto_group_v3",
        {
          requested_operation_key: operationKey,
          group_code: code,
          invitation_token: invitationToken,
          participant_name: participantName,
          participant_phone: participantPhone,
          current_participant_token:
            storedAccess?.code === code ? storedAccess.participantToken : null,
        },
      )) as JoinResult;
      if (!TOKEN.test(result.participant_token))
        throw new Error("A identificação do participante é inválida.");
      const prepared = accessCookies({
        code,
        participantToken: result.participant_token,
      });
      return secureJson(
        {
          data: {
            room: result.room,
            access: { participant: true, organizer: false },
          },
        },
        200,
        prepared.values,
      );
    }

    const currentAccess = storedAccess?.code === code ? storedAccess : null;

    if (action === "room") {
      if (!TOKEN.test(invitationToken))
        return secureJson({ error: "Convite inválido." }, 400);
      const room = await rpc(supabaseUrl, secretKey, "pede_junto_room", {
        group_code: code,
        invitation_token: invitationToken,
        participant_token: currentAccess?.participantToken || null,
      });
      return secureJson({
        data: { room, access: publicAccess(currentAccess, code) },
      });
    }

    const csrfRejection = guardBffCsrf(request, validGroupCsrf);
    if (csrfRejection) return csrfRejection;

    if (action === "select") {
      if (!currentAccess?.participantToken)
        return secureJson({ error: "Entre no grupo antes de escolher." }, 403);
      const flavorId = text(body.selected_flavor_id, 36);
      const quantity = Number(body.selected_quantity);
      if (
        !UUID.test(flavorId) ||
        !Number.isInteger(quantity) ||
        quantity < 0 ||
        quantity > 30
      )
        return secureJson({ error: "Escolha de sabor inválida." }, 400);
      const room = await rpc(
        supabaseUrl,
        secretKey,
        "set_pede_junto_selection",
        {
          group_code: code,
          participant_token: currentAccess.participantToken,
          selected_flavor_id: flavorId,
          selected_quantity: quantity,
        },
      );
      return secureJson({
        data: { room, access: publicAccess(currentAccess, code) },
      });
    }

    if (action === "submit") {
      if (!currentAccess?.organizerToken)
        return secureJson(
          { error: "Apenas o organizador pode encerrar o grupo." },
          403,
        );
      const result = await rpc(
        supabaseUrl,
        secretKey,
        "submit_pede_junto_group",
        {
          group_code: code,
          organizer_token: currentAccess.organizerToken,
        },
      );
      return secureJson({ data: result });
    }

    return secureJson({ error: "Ação inválida." }, 400);
  } catch (error) {
    return secureJson(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível concluir a ação do Pede Junto.",
      },
      502,
    );
  }
};

export const config = { path: "/api/pede-junto" };
