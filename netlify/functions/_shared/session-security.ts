import { secureResponseHeaders } from "./response-security";

export const ACCESS_COOKIE = "__Host-adoce-access";
export const REFRESH_COOKIE = "__Host-adoce-refresh";
export const SURFACE_COOKIE = "__Host-adoce-surface";
export const CSRF_COOKIE = "__Host-adoce-csrf";
export const SESSION_MODE_COOKIE = "__Host-adoce-session-mode";

export type AuthSurface = "client" | "operation";

export type SupabaseTokenPayload = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
  user?: { id?: string; email?: string | null };
};

declare const Netlify:
  | { env: { get(name: string): string | undefined } }
  | undefined;

const env = (name: string) =>
  (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) ||
  process.env[name];

const ACCESS_MAX_AGE_SECONDS = 15 * 60;
const REMEMBERED_REFRESH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const SESSION_REFRESH_MAX_AGE_SECONDS = 8 * 60 * 60;

const LOCAL_DEPLOY_ENVIRONMENTS = new Set(["local", "development", "test"]);
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const PRODUCTION_HOSTS = new Set([
  "adocebrigaderia.com.br",
  "www.adocebrigaderia.com.br",
  "clube.adocebrigaderia.com.br",
  "operacao.adocebrigaderia.com.br",
]);

const encode = (value: string) => encodeURIComponent(value);
const decode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export function parseCookies(request: Request) {
  const result = new Map<string, string>();
  const raw = request.headers.get("cookie") || "";
  raw.split(";").forEach((entry) => {
    const separator = entry.indexOf("=");
    if (separator < 1) return;
    const key = entry.slice(0, separator).trim();
    const value = entry.slice(separator + 1).trim();
    if (key) result.set(key, decode(value));
  });
  return result;
}

function cookie(
  name: string,
  value: string,
  options: {
    maxAge: number;
    httpOnly: boolean;
    sameSite?: "Lax" | "Strict";
  },
) {
  return [
    `${name}=${encode(value)}`,
    "Path=/",
    `Max-Age=${Math.max(0, Math.floor(options.maxAge))}`,
    "Secure",
    options.httpOnly ? "HttpOnly" : "",
    `SameSite=${options.sameSite || "Lax"}`,
  ].filter(Boolean).join("; ");
}

export function generateCsrfToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export function sessionCookies(
  tokens: SupabaseTokenPayload,
  surface: AuthSurface,
  remember: boolean,
  csrfToken = generateCsrfToken(),
) {
  const refreshMaxAge = remember
    ? REMEMBERED_REFRESH_MAX_AGE_SECONDS
    : SESSION_REFRESH_MAX_AGE_SECONDS;
  const accessMaxAge = Math.min(
    ACCESS_MAX_AGE_SECONDS,
    Math.max(60, Number(tokens.expires_in) || ACCESS_MAX_AGE_SECONDS),
  );
  return {
    csrfToken,
    values: [
      cookie(ACCESS_COOKIE, tokens.access_token, {
        maxAge: accessMaxAge,
        httpOnly: true,
      }),
      cookie(REFRESH_COOKIE, tokens.refresh_token, {
        maxAge: refreshMaxAge,
        httpOnly: true,
      }),
      cookie(SURFACE_COOKIE, surface, {
        maxAge: refreshMaxAge,
        httpOnly: true,
        sameSite: "Strict",
      }),
      cookie(CSRF_COOKIE, csrfToken, {
        maxAge: refreshMaxAge,
        httpOnly: false,
        sameSite: "Strict",
      }),
      cookie(SESSION_MODE_COOKIE, remember ? "remembered" : "session", {
        maxAge: refreshMaxAge,
        httpOnly: true,
        sameSite: "Strict",
      }),
    ],
  };
}

export function clearedSessionCookies() {
  return [
    ACCESS_COOKIE,
    REFRESH_COOKIE,
    SURFACE_COOKIE,
    CSRF_COOKIE,
    SESSION_MODE_COOKIE,
  ].map((name) =>
    cookie(name, "", {
      maxAge: 0,
      httpOnly: name !== CSRF_COOKIE,
      sameSite:
        name === SURFACE_COOKIE ||
        name === CSRF_COOKIE ||
        name === SESSION_MODE_COOKIE
          ? "Strict"
          : "Lax",
    }),
  );
}

export function appendCookies(headers: Headers, values: string[]) {
  values.forEach((value) => headers.append("Set-Cookie", value));
  return headers;
}

function fixedTimeEqual(left: string, right: string) {
  if (!left || left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export function validCsrf(request: Request) {
  const cookies = parseCookies(request);
  const cookieToken = cookies.get(CSRF_COOKIE) || "";
  const headerToken = request.headers.get("x-csrf-token") || "";
  return /^[a-f0-9]{64}$/i.test(cookieToken) && fixedTimeEqual(cookieToken, headerToken);
}

type OriginNormalizationOptions = {
  allowLoopbackHttp: boolean;
  rejectProductionHosts: boolean;
};

function normalizedOrigin(
  value: string | undefined,
  options: OriginNormalizationOptions,
) {
  const candidate = value?.trim();
  if (!candidate || candidate === "null") return null;

  try {
    const url = new URL(candidate);
    const hostname = url.hostname.toLowerCase();
    const originOnly =
      (url.pathname === "/" || url.pathname === "") &&
      !url.search &&
      !url.hash &&
      !url.username &&
      !url.password;

    if (!originOnly) return null;
    if (url.protocol === "http:") {
      if (!options.allowLoopbackHttp || !LOOPBACK_HOSTS.has(hostname)) return null;
    } else if (url.protocol !== "https:") {
      return null;
    }

    if (options.rejectProductionHosts && PRODUCTION_HOSTS.has(hostname)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function originPolicy() {
  const deployEnvironment = (env("ADOCE_DEPLOY_ENV") || "unknown").trim().toLowerCase();
  const local = LOCAL_DEPLOY_ENVIRONMENTS.has(deployEnvironment);
  return {
    allowLoopbackHttp: local,
    rejectProductionHosts: deployEnvironment === "homologation",
  } satisfies OriginNormalizationOptions;
}

function allowedOrigins(configuredSiteUrl?: string) {
  const origins = new Set<string>();
  const policy = originPolicy();
  const configuredValues = [
    configuredSiteUrl,
    env("BFF_ALLOWED_ORIGINS"),
    env("SITE_URL"),
  ];

  configuredValues.forEach((value) => {
    value?.split(/[\n,]/).forEach((entry) => {
      const origin = normalizedOrigin(entry, policy);
      if (origin) origins.add(origin);
    });
  });

  if (policy.allowLoopbackHttp) {
    [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:4182",
      "http://127.0.0.1:4182",
    ].forEach((origin) => origins.add(origin));
  }

  return origins;
}

function safeRequestWithoutOrigin(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (!fetchSite) return true;
  return fetchSite === "same-origin" || fetchSite === "none";
}

export function allowedOrigin(request: Request, configuredSiteUrl?: string) {
  const method = request.method.toUpperCase();
  const originHeader = request.headers.get("origin");
  if (!originHeader) {
    const safeMethod = method === "GET" || method === "HEAD" || method === "OPTIONS";
    return safeMethod && safeRequestWithoutOrigin(request);
  }

  const origin = normalizedOrigin(originHeader, originPolicy());
  return Boolean(origin && allowedOrigins(configuredSiteUrl).has(origin));
}

export function secureJson(
  body: unknown,
  status = 200,
  cookies: string[] = [],
) {
  const headers = appendCookies(
    secureResponseHeaders({
      contentType: "application/json; charset=utf-8",
      vary: "Cookie, Origin, Sec-Fetch-Site",
    }),
    cookies,
  );
  return new Response(JSON.stringify(body), { status, headers });
}
