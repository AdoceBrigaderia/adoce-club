const PRODUCTION_HOSTS = new Set([
  "adocebrigaderia.com.br",
  "www.adocebrigaderia.com.br",
  "clube.adocebrigaderia.com.br",
]);

const META_VARIABLES = [
  "META_WA_ACCESS_TOKEN",
  "META_WA_PHONE_NUMBER_ID",
  "META_WA_WABA_ID",
  "META_WA_APP_SECRET",
  "META_WA_VERIFY_TOKEN",
  "META_WA_AUTH_TEMPLATE_NAME",
  "META_WA_GRAPH_API_VERSION",
] as const;

const WALLET_VARIABLES = [
  "GOOGLE_WALLET_ISSUER_ID",
  "GOOGLE_WALLET_CLASS_ID",
  "GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_WALLET_PRIVATE_KEY",
] as const;

const PASSKEY_VARIABLES = [
  "PASSKEY_RP_ID",
  "PASSKEY_ALLOWED_ORIGINS",
] as const;

export type ReadinessEnvironment = Record<string, string | undefined>;

function value(environment: ReadinessEnvironment, name: string) {
  return String(environment[name] || "").trim();
}

function missing(
  environment: ReadinessEnvironment,
  variables: readonly string[],
) {
  return variables.filter((name) => !value(environment, name));
}

function projectRef(rawUrl: string) {
  try {
    const hostname = new URL(rawUrl).hostname.toLowerCase();
    return hostname.match(/^([a-z0-9-]+)\.supabase\.co$/)?.[1] || null;
  } catch {
    return null;
  }
}

function siteState(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    const production = PRODUCTION_HOSTS.has(url.hostname.toLowerCase());
    return {
      valid: url.protocol === "https:" && !production,
      origin: url.origin,
      production,
    };
  } catch {
    return { valid: false, origin: null, production: false };
  }
}

function originList(raw: string) {
  return raw
    .split(",")
    .map((item) => item.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

export function buildHomologationReadiness(
  environment: ReadinessEnvironment,
  now = new Date(),
) {
  const deployEnvironment = value(environment, "ADOCE_DEPLOY_ENV").toLowerCase();
  const expectedRef = value(
    environment,
    "ADOCE_HOMOLOGATION_SUPABASE_REF",
  ).toLowerCase();
  const productionRef = value(
    environment,
    "ADOCE_PRODUCTION_SUPABASE_REF",
  ).toLowerCase();
  const browserRef = projectRef(value(environment, "VITE_SUPABASE_URL"));
  const serverRef = projectRef(
    value(environment, "SUPABASE_URL") ||
      value(environment, "VITE_SUPABASE_URL"),
  );
  const site = siteState(value(environment, "SITE_URL"));
  const allowedOrigins = originList(value(environment, "BFF_ALLOWED_ORIGINS"));
  const siteAllowed = Boolean(
    site.origin && allowedOrigins.includes(site.origin.replace(/\/+$/, "")),
  );
  const supabaseIsolated = Boolean(
    expectedRef &&
      browserRef === expectedRef &&
      serverRef === expectedRef &&
      (!productionRef || productionRef !== expectedRef),
  );
  const publishableKeyPresent = Boolean(
    value(environment, "VITE_SUPABASE_PUBLISHABLE_KEY") &&
      !/^(?:sb_secret_|service_role)/i.test(
        value(environment, "VITE_SUPABASE_PUBLISHABLE_KEY"),
      ),
  );
  const serverSecretPresent = Boolean(
    value(environment, "SUPABASE_SECRET_KEY") ||
      value(environment, "SUPABASE_SERVICE_ROLE_KEY"),
  );
  const metaMissing = missing(environment, META_VARIABLES);
  const walletMissing = missing(environment, WALLET_VARIABLES);
  const passkeyMissing = missing(environment, PASSKEY_VARIABLES);
  const passkeyOrigins = originList(
    value(environment, "PASSKEY_ALLOWED_ORIGINS"),
  );
  const passkeySiteAllowed = Boolean(
    site.origin && passkeyOrigins.includes(site.origin.replace(/\/+$/, "")),
  );
  const coreReady = Boolean(
    deployEnvironment === "homologation" &&
      site.valid &&
      siteAllowed &&
      supabaseIsolated &&
      publishableKeyPresent &&
      serverSecretPresent,
  );

  return {
    environment: deployEnvironment || "unknown",
    exposed: deployEnvironment === "homologation",
    coreReady,
    site: {
      validHomologationOrigin: site.valid,
      productionDomainRejected: !site.production,
      allowedByBff: siteAllowed,
      origin: site.origin,
    },
    supabase: {
      isolated: supabaseIsolated,
      projectRef: browserRef,
      frontendAndFunctionsMatch: Boolean(
        browserRef && serverRef && browserRef === serverRef,
      ),
      publishableKeyPresent,
      serverSecretPresent,
    },
    integrations: {
      passkeys: {
        configured: passkeyMissing.length === 0 && passkeySiteAllowed,
        originAllowed: passkeySiteAllowed,
        missing: passkeyMissing,
      },
      metaWhatsApp: {
        configured: metaMissing.length === 0,
        missing: metaMissing,
      },
      googleWallet: {
        configured: walletMissing.length === 0,
        missing: walletMissing,
      },
    },
    build: {
      commit: value(environment, "COMMIT_REF").slice(0, 40) || null,
      context:
        value(environment, "CONTEXT") ||
        value(environment, "NETLIFY_CONTEXT") ||
        null,
    },
    checkedAt: now.toISOString(),
  };
}
