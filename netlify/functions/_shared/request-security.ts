import {
  allowedOrigin,
  secureJson,
  validCsrf,
} from "./session-security";

export type BffRequestGuardOptions = {
  methods: readonly string[];
  configuredSiteUrl?: string;
  requireCsrf?: boolean;
};

function normalizeMethods(methods: readonly string[]) {
  const normalized = Array.from(
    new Set(
      methods
        .map((method) => method.trim().toUpperCase())
        .filter((method) => /^[A-Z]+$/.test(method) && method !== "OPTIONS"),
    ),
  );
  if (normalized.length === 0) {
    throw new TypeError("O guard BFF exige ao menos um método HTTP válido.");
  }
  return normalized;
}

export function guardBffRequest(
  request: Request,
  options: BffRequestGuardOptions,
): Response | null {
  const method = request.method.toUpperCase();
  const allowedMethods = normalizeMethods(options.methods);

  if (method === "OPTIONS") {
    return secureJson(
      {
        error: "Preflight CORS não permitido. Use a API pela mesma origem do portal.",
        code: "cors_preflight_denied",
      },
      403,
    );
  }

  if (!allowedMethods.includes(method)) {
    return secureJson(
      { error: "Método não permitido.", code: "method_not_allowed" },
      405,
    );
  }

  if (!allowedOrigin(request, options.configuredSiteUrl)) {
    return secureJson(
      { error: "Origem não autorizada.", code: "origin_not_allowed" },
      403,
    );
  }

  if (options.requireCsrf && !validCsrf(request)) {
    return secureJson(
      {
        error: "Validação de segurança inválida.",
        code: "csrf_validation_failed",
      },
      403,
    );
  }

  return null;
}
