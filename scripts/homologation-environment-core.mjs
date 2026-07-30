const PRODUCTION_HOSTS = new Set([
  "adocebrigaderia.com.br",
  "www.adocebrigaderia.com.br",
  "clube.adocebrigaderia.com.br",
]);

const META_CREDENTIAL_FIELDS = [
  "META_WA_ACCESS_TOKEN",
  "META_WA_PHONE_NUMBER_ID",
  "META_WA_WABA_ID",
  "META_WA_APP_SECRET",
  "META_WA_VERIFY_TOKEN",
  "META_WA_AUTH_TEMPLATE_NAME",
];

const GOOGLE_WALLET_CREDENTIAL_FIELDS = [
  "GOOGLE_WALLET_ISSUER_ID",
  "GOOGLE_WALLET_CLASS_ID",
  "GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_WALLET_PRIVATE_KEY",
];

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

function analyzeOriginList(value) {
  const origins = [];
  const invalid = [];
  const production = [];

  for (const rawEntry of normalized(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)) {
    try {
      const url = new URL(rawEntry);
      const originOnly =
        (url.pathname === "/" || url.pathname === "") &&
        !url.search &&
        !url.hash;
      if (url.protocol !== "https:" || !originOnly) {
        invalid.push(rawEntry);
        continue;
      }

      const origin = url.origin;
      if (PRODUCTION_HOSTS.has(url.hostname.toLowerCase())) {
        production.push(origin);
      }
      if (!origins.includes(origin)) origins.push(origin);
    } catch {
      invalid.push(rawEntry);
    }
  }

  return { origins, invalid, production };
}

function configuredFields(environment, names) {
  return names.filter((name) => Boolean(normalized(environment[name])));
}

function missingFields(environment, names) {
  return names.filter((name) => !normalized(environment[name]));
}

function validateOriginCollection(errors, variableName, analysis) {
  if (analysis.invalid.length) {
    errors.push(
      `${variableName} contém origem inválida; use apenas origens HTTPS sem caminho, parâmetros ou fragmento.`,
    );
  }
  if (analysis.production.length) {
    errors.push(`${variableName} não pode incluir domínios produtivos.`);
  }
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
  const bffOrigins = analyzeOriginList(environment.BFF_ALLOWED_ORIGINS);
  const passkeyOrigins = analyzeOriginList(environment.PASSKEY_ALLOWED_ORIGINS);
  const walletOrigins = analyzeOriginList(environment.GOOGLE_WALLET_ORIGINS);
  const passkeyRpId = normalized(environment.PASSKEY_RP_ID).toLowerCase();
  const siteHostname = siteOrigin
    ? new URL(siteOrigin).hostname.toLowerCase()
    : null;

  const metaEnvironment = normalized(environment.META_WA_ENVIRONMENT).toLowerCase();
  const metaConfiguredFields = configuredFields(environment, META_CREDENTIAL_FIELDS);
  const metaMissingFields = missingFields(environment, META_CREDENTIAL_FIELDS);
  const metaConfigured = metaConfiguredFields.length > 0;
  const metaGraphVersion = normalized(environment.META_WA_GRAPH_API_VERSION);

  const walletConfiguredFields = configuredFields(
    environment,
    GOOGLE_WALLET_CREDENTIAL_FIELDS,
  );
  const walletMissingFields = missingFields(
    environment,
    GOOGLE_WALLET_CREDENTIAL_FIELDS,
  );
  const walletConfigured = walletConfiguredFields.length > 0;

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

  validateOriginCollection(errors, "BFF_ALLOWED_ORIGINS", bffOrigins);
  validateOriginCollection(errors, "PASSKEY_ALLOWED_ORIGINS", passkeyOrigins);
  validateOriginCollection(errors, "GOOGLE_WALLET_ORIGINS", walletOrigins);

  if (siteOrigin && !bffOrigins.origins.includes(siteOrigin)) {
    errors.push("BFF_ALLOWED_ORIGINS deve incluir exatamente a origem de SITE_URL.");
  }
  if (siteOrigin && !passkeyOrigins.origins.includes(siteOrigin)) {
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

  if (metaEnvironment && metaEnvironment !== "homologation") {
    errors.push("META_WA_ENVIRONMENT deve ser homologation na homologação.");
  }
  if (metaGraphVersion && !/^v\d{1,2}\.\d{1,2}$/.test(metaGraphVersion)) {
    errors.push("META_WA_GRAPH_API_VERSION inválida.");
  }
  if (metaConfigured && metaMissingFields.length) {
    errors.push(
      `A Meta WhatsApp está parcialmente configurada; faltam: ${metaMissingFields.join(", ")}.`,
    );
  }
  if (metaConfigured && !metaGraphVersion) {
    errors.push("META_WA_GRAPH_API_VERSION é obrigatória quando a Meta está ativa.");
  }
  if (!metaConfigured) {
    warnings.push(
      "Meta WhatsApp ainda sem credenciais; adapter/mock e fallbacks permanecem disponíveis.",
    );
  }

  if (walletConfigured && walletMissingFields.length) {
    errors.push(
      `Google Wallet está parcialmente configurado; faltam: ${walletMissingFields.join(", ")}.`,
    );
  }
  if (
    walletConfigured &&
    siteOrigin &&
    !walletOrigins.origins.includes(siteOrigin)
  ) {
    errors.push("GOOGLE_WALLET_ORIGINS deve incluir exatamente a origem de SITE_URL.");
  }
  if (!walletConfigured) {
    warnings.push(
      "Google Wallet ainda sem credenciais; o QR pessoal e o cartão digital permanecem disponíveis.",
    );
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
      bffOriginMatches: Boolean(
        siteOrigin && bffOrigins.origins.includes(siteOrigin),
      ),
      bffOriginsSafe:
        bffOrigins.invalid.length === 0 && bffOrigins.production.length === 0,
      passkeyOriginMatches: Boolean(
        siteOrigin && passkeyOrigins.origins.includes(siteOrigin),
      ),
      passkeyOriginsSafe:
        passkeyOrigins.invalid.length === 0 &&
        passkeyOrigins.production.length === 0,
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
      metaEnvironmentMatches: !metaEnvironment || metaEnvironment === "homologation",
      metaConfigured,
      metaComplete: metaConfigured && metaMissingFields.length === 0,
      metaGraphVersionValid: Boolean(
        metaGraphVersion && /^v\d{1,2}\.\d{1,2}$/.test(metaGraphVersion),
      ),
      googleWalletConfigured: walletConfigured,
      googleWalletComplete:
        walletConfigured && walletMissingFields.length === 0,
      googleWalletOriginMatches: Boolean(
        siteOrigin && walletOrigins.origins.includes(siteOrigin),
      ),
      googleWalletOriginsSafe:
        walletOrigins.invalid.length === 0 &&
        walletOrigins.production.length === 0,
    },
  };
}
