const PRODUCTION_HOSTS = new Set([
  "adocebrigaderia.com.br",
  "www.adocebrigaderia.com.br",
  "clube.adocebrigaderia.com.br",
]);

const CORE_SECURITY_VARIABLES = [
  "WHATSAPP_OTP_PEPPER",
  "PUBLIC_RATE_LIMIT_PEPPER",
] as const;

const META_CREDENTIAL_VARIABLES = [
  "META_WA_ACCESS_TOKEN",
  "META_WA_PHONE_NUMBER_ID",
  "META_WA_WABA_ID",
  "META_WA_APP_SECRET",
  "META_WA_VERIFY_TOKEN",
  "META_WA_AUTH_TEMPLATE_NAME",
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

function configuredCount(
  environment: ReadinessEnvironment,
  variables: readonly string[],
) {
  return variables.filter((name) => Boolean(value(environment, name))).length;
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
    const originOnly =
      (url.pathname === "/" || url.pathname === "") &&
      !url.search &&
      !url.hash;
    return {
      valid: url.protocol === "https:" && !production && originOnly,
      origin: url.origin,
      production,
      originOnly,
    };
  } catch {
    return {
      valid: false,
      origin: null,
      production: false,
      originOnly: false,
    };
  }
}

function analyzeOrigins(raw: string) {
  const origins: string[] = [];
  const invalid: string[] = [];
  const production: string[] = [];

  for (const rawEntry of raw
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

  return {
    origins,
    invalid,
    production,
    safe: invalid.length === 0 && production.length === 0,
  };
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
  const requestSite = siteState(value(environment, "READINESS_REQUEST_ORIGIN"));
  const configuredHostname = site.origin
    ? new URL(site.origin).hostname.toLowerCase()
    : "";
  const requestHostname = requestSite.origin
    ? new URL(requestSite.origin).hostname.toLowerCase()
    : "";
  const requestIsConfiguredDeployAlias = Boolean(
    configuredHostname.endsWith(".netlify.app") &&
      requestHostname.endsWith(`--${configuredHostname}`),
  );
  const requestMatchesConfiguredSite = Boolean(
    site.origin &&
      requestSite.origin &&
      (site.origin === requestSite.origin || requestIsConfiguredDeployAlias),
  );

  const allowedOrigins = analyzeOrigins(
    value(environment, "BFF_ALLOWED_ORIGINS"),
  );
  const siteAllowed = Boolean(
    site.origin && allowedOrigins.origins.includes(site.origin),
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
  const coreSecurityMissing = missing(environment, CORE_SECURITY_VARIABLES);

  const passkeyMissing = missing(environment, PASSKEY_VARIABLES);
  const passkeyOrigins = analyzeOrigins(
    value(environment, "PASSKEY_ALLOWED_ORIGINS"),
  );
  const passkeySiteAllowed = Boolean(
    site.origin && passkeyOrigins.origins.includes(site.origin),
  );
  const passkeyRpIdMatches = Boolean(
    configuredHostname &&
      value(environment, "PASSKEY_RP_ID").toLowerCase() === configuredHostname,
  );

  const metaMissing = missing(environment, META_CREDENTIAL_VARIABLES);
  const metaConfiguredCount = configuredCount(
    environment,
    META_CREDENTIAL_VARIABLES,
  );
  const metaPartiallyConfigured =
    metaConfiguredCount > 0 && metaMissing.length > 0;
  const metaEnvironment = value(environment, "META_WA_ENVIRONMENT").toLowerCase();
  const metaEnvironmentMatches =
    !metaEnvironment || metaEnvironment === "homologation";
  const metaGraphVersion = value(environment, "META_WA_GRAPH_API_VERSION");
  const metaGraphVersionValid = /^v\d{1,2}\.\d{1,2}$/.test(metaGraphVersion);
  const metaConfigured = Boolean(
    metaConfiguredCount === META_CREDENTIAL_VARIABLES.length &&
      metaMissing.length === 0 &&
      metaEnvironmentMatches &&
      metaGraphVersionValid,
  );

  const walletMissing = missing(environment, WALLET_VARIABLES);
  const walletConfiguredCount = configuredCount(environment, WALLET_VARIABLES);
  const walletPartiallyConfigured =
    walletConfiguredCount > 0 && walletMissing.length > 0;
  const walletOrigins = analyzeOrigins(
    value(environment, "GOOGLE_WALLET_ORIGINS"),
  );
  const walletSiteAllowed = Boolean(
    site.origin && walletOrigins.origins.includes(site.origin),
  );
  const walletConfigured = Boolean(
    walletConfiguredCount === WALLET_VARIABLES.length &&
      walletMissing.length === 0 &&
      walletOrigins.safe &&
      walletSiteAllowed,
  );

  const coreReady = Boolean(
    deployEnvironment === "homologation" &&
      site.valid &&
      requestSite.valid &&
      requestMatchesConfiguredSite &&
      siteAllowed &&
      allowedOrigins.safe &&
      supabaseIsolated &&
      publishableKeyPresent &&
      serverSecretPresent &&
      coreSecurityMissing.length === 0,
  );

  return {
    environment: deployEnvironment || "unknown",
    exposed: deployEnvironment === "homologation",
    coreReady,
    site: {
      validHomologationOrigin: site.valid,
      requestOriginValid: requestSite.valid,
      requestMatchesConfiguredSite,
      productionDomainRejected:
        !site.production &&
        !requestSite.production &&
        allowedOrigins.production.length === 0,
      allowedByBff: siteAllowed,
      allowedOriginsSafe: allowedOrigins.safe,
      invalidAllowedOrigins: allowedOrigins.invalid.length,
      productionAllowedOrigins: allowedOrigins.production.length,
      origin: site.origin,
      requestOrigin: requestSite.origin,
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
    security: {
      configured: coreSecurityMissing.length === 0,
      missing: coreSecurityMissing,
    },
    integrations: {
      passkeys: {
        configured:
          passkeyMissing.length === 0 &&
          passkeySiteAllowed &&
          passkeyOrigins.safe &&
          passkeyRpIdMatches,
        originAllowed: passkeySiteAllowed,
        originsSafe: passkeyOrigins.safe,
        rpIdMatches: passkeyRpIdMatches,
        missing: passkeyMissing,
      },
      metaWhatsApp: {
        configured: metaConfigured,
        partiallyConfigured: metaPartiallyConfigured,
        environmentMatches: metaEnvironmentMatches,
        graphVersionValid: metaGraphVersionValid,
        missing: metaMissing,
      },
      googleWallet: {
        configured: walletConfigured,
        partiallyConfigured: walletPartiallyConfigured,
        originAllowed: walletSiteAllowed,
        originsSafe: walletOrigins.safe,
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
