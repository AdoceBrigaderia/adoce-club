const PRODUCTION_HOSTS = new Set([
  "adocebrigaderia.com.br",
  "www.adocebrigaderia.com.br",
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

function validPreviewHost(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !PRODUCTION_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function validateHomologationEnvironment(environment) {
  const errors = [];
  const warnings = [];
  const deployEnvironment = normalized(environment.ADOCE_DEPLOY_ENV).toLowerCase();
  const netlifyContext = normalized(environment.CONTEXT || environment.NETLIFY_CONTEXT).toLowerCase();
  const siteUrl = normalized(environment.SITE_URL);
  const browserUrl = normalized(environment.VITE_SUPABASE_URL);
  const serverUrl = normalized(environment.SUPABASE_URL);
  const expectedRef = normalized(environment.ADOCE_HOMOLOGATION_SUPABASE_REF).toLowerCase();
  const productionRef = normalized(environment.ADOCE_PRODUCTION_SUPABASE_REF).toLowerCase();
  const browserRef = extractSupabaseProjectRef(browserUrl);
  const serverRef = extractSupabaseProjectRef(serverUrl);
  const publishableKey = normalized(environment.VITE_SUPABASE_PUBLISHABLE_KEY);

  if (deployEnvironment !== "homologation") {
    errors.push("ADOCE_DEPLOY_ENV deve ser homologation.");
  }
  if (netlifyContext === "production") {
    errors.push("O contexto Netlify de produção não pode publicar homologação.");
  }
  if (!validPreviewHost(siteUrl)) {
    errors.push("SITE_URL deve ser uma origem HTTPS de homologação, nunca o domínio de produção.");
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
      previewOriginConfigured: validPreviewHost(siteUrl),
      browserProjectMatches: Boolean(expectedRef && browserRef === expectedRef),
      serverProjectMatches: Boolean(expectedRef && serverRef === expectedRef),
      publicBrowserKey: Boolean(
        publishableKey && !/^(?:sb_secret_|service_role)/i.test(publishableKey),
      ),
    },
  };
}
