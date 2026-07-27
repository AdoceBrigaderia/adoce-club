const PRODUCTION_HOSTS = new Set([
  "adocebrigaderia.com.br",
  "www.adocebrigaderia.com.br",
  "clube.adocebrigaderia.com.br",
]);

export function extractSupabaseProjectRef(value) {
  if (!value) return null;
  try {
    const host = new URL(value).hostname.toLowerCase();
    const match = host.match(/^([a-z0-9-]+)\.supabase\.co$/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

function normalized(value) {
  return String(value || "").trim();
}

function previewOrigin(value) {
  try {
    const url = new URL(value);
    const production = PRODUCTION_HOSTS.has(url.hostname.toLowerCase());
    const originOnly =
      (url.pathname === "/" || url.pathname === "") && !url.search && !url.hash;
    return url.protocol === "https:" && !production && originOnly
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

function originList(value) {
  return normalized(value)
    .split(",")
    .map((item) => item.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

export function validateHomologationEnvironment(environment) {
  const errors = [];
  const warnings = [];
  const deployEnvironment = normalized(environment.ADOCE_DEPLOY_ENV).toLowerCase();
  const netlifyContext = normalized(
    environment.CONTEXT || environment.NETLIFY_CONTEXT,
  ).toLowerCase();
  const siteUrl = normalized(environment.SITE_URL);
  const siteOrigin = previewOrigin(siteUrl);
  const browserUrl = normalized(environment.VITE_SUPABASE_URL);
  const serverUrl = normalized(environment.SUPABASE_URL);
  const expectedRef = normalized(
    environment.ADOCE_HOMOLOGATION_SUPABASE_REF,
  ).toLowerCase();
  const productionRef = normalized(
    environment.ADOCE_PRODUCTION_SUPABASE_REF,
  ).toLowerCase();
  const browserRef = extractSupabaseProjectRef(browserUrl);
  const serverRef = extractSupabaseProjectRef(serverUrl);
  const publishableKey = normalized(environment.VITE_SUPABASE_PUBLISHABLE_KEY);
  const serverSecret = normalized(
    environment.SUPABASE_SECRET_KEY || environment.SUPABASE_SERVICE_ROLE_KEY,
  );
  const otpPepper = normalized(environment.WHATSAPP_OTP_PEPPER);
  const rateLimitPepper = normalized(environment.PUBLIC_RATE_LIMIT_PEPPER);
  const bffOrigins = originList(environment.BFF_ALLOWED_ORIGINS);
  const passkeyOrigins = originList(environment.PASSKEY_ALLOWED_ORIGINS);
  const passkeyRpId = normalized(environment.PASSKEY_RP_ID).toLowerCase();
  const siteHostname = siteOrigin
    ? new URL(siteOrigin).hostname.toLowerCase()
    : null;

  if (deployEnvironment !== "homologation") {
    errors.push("ADOCE_DEPLOY_ENV deve ser homologation.");
  }
  if (netlifyContext === "production") {
    errors.push("O contexto Netlify de produção não pode publicar homologação.");
  }
  if (!siteOrigin) {
    errors.push(
      "SITE_URL deve ser uma origem HTTPS de homologação, sem caminho, parâmetros ou domínio de produção.",
    );
  }
  if (siteOrigin && !bffOrigins.includes(siteOrigin)) {
    errors.push("BFF_ALLOWED_ORIGINS deve incluir exatamente a origem de SITE_URL.");
  }
  if (siteOrigin && !passkeyOrigins.includes(siteOrigin)) {
    errors.push("PASSKEY_ALLOWED_ORIGINS deve incluir exatamente a origem de SITE_URL.");
  }
  if (siteHostname && passkeyRpId !== siteHostname) {
    errors.push("PASSKEY_RP_ID deve ser o hostname exato de SITE_URL.");
  }
  if (!expectedRef || !/^[a-z0-9-]+$/.test(expectedRef)) {
    errors.push("ADOCE_HOMOLOGATION_SUPABASE_REF não foi configurado corretamente.");
  }
  if (!browserRef) {
    errors.push("VITE_SUPABASE_URL não aponta para um projeto Supabase válido.");
  }
  if (!serverRef) {
    errors.push("SUPABASE_URL não aponta para um projeto Supabase válido.");
  }
  if (expectedRef && browserRef && browserRef !== expectedRef) {
    errors.push("O frontend não aponta para o Supabase de homologação autorizado.");
  }
  if (expectedRef && serverRef && serverRef !== expectedRef) {
    errors.push("As Functions não apontam para o Supabase de homologação autorizado.");
  }
  if (browserRef && serverRef && browserRef !== serverRef) {
    errors.push("Frontend e Functions estão ligados a projetos Supabase diferentes.");
  }
  if (productionRef && expectedRef && productionRef === expectedRef) {
    errors.push("As referências de homologação e produção não podem ser iguais.");
  }
  if (productionRef && (browserRef === productionRef || serverRef === productionRef)) {
    errors.push("A publicação de homologação tentou usar o Supabase de produção.");
  }
  if (!publishableKey) {
    errors.push("VITE_SUPABASE_PUBLISHABLE_KEY não foi configurada.");
  } else if (/^(?:sb_secret_|service_role)/i.test(publishableKey)) {
    errors.push("O frontend recebeu uma chave secreta em vez da chave publicável.");
  }
  if (!serverSecret) {
    errors.push("SUPABASE_SECRET_KEY deve existir somente no cofre da Netlify.");
  }
  if (!otpPepper) {
    errors.push("WHATSAPP_OTP_PEPPER deve existir somente no cofre da Netlify.");
  }
  if (!rateLimitPepper) {
    errors.push("PUBLIC_RATE_LIMIT_PEPPER deve existir somente no cofre da Netlify.");
  }
  if (otpPepper && rateLimitPepper && otpPepper === rateLimitPepper) {
    errors.push("Os peppers de OTP e rate limit devem ser valores distintos.");
  }

  if (!normalized(environment.ADOCE_PRODUCTION_SUPABASE_REF)) {
    warnings.push(
      "ADOCE_PRODUCTION_SUPABASE_REF ausente; a igualdade com produção não pôde ser conferida pela referência explícita.",
    );
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    checks: {
      deployEnvironment: deployEnvironment || null,
      netlifyContext: netlifyContext || null,
      previewOriginConfigured: Boolean(siteOrigin),
      bffOriginMatches: Boolean(siteOrigin && bffOrigins.includes(siteOrigin)),
      passkeyOriginMatches: Boolean(
        siteOrigin && passkeyOrigins.includes(siteOrigin),
      ),
      passkeyRpIdMatches: Boolean(siteHostname && passkeyRpId === siteHostname),
      browserProjectMatches: Boolean(expectedRef && browserRef === expectedRef),
      serverProjectMatches: Boolean(expectedRef && serverRef === expectedRef),
      serverSecretPresent: Boolean(serverSecret),
      otpPepperPresent: Boolean(otpPepper),
      rateLimitPepperPresent: Boolean(rateLimitPepper),
      peppersSeparated: Boolean(
        otpPepper && rateLimitPepper && otpPepper !== rateLimitPepper,
      ),
      publicBrowserKey: Boolean(
        publishableKey && !/^(?:sb_secret_|service_role)/i.test(publishableKey),
      ),
    },
  };
}
