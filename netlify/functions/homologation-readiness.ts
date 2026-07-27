import { buildHomologationReadiness } from "./_shared/homologation-readiness";
import { secureJson } from "./_shared/session-security";

declare const Netlify:
  | { env: { get(name: string): string | undefined } }
  | undefined;

const variableNames = [
  "ADOCE_DEPLOY_ENV",
  "ADOCE_HOMOLOGATION_SUPABASE_REF",
  "ADOCE_PRODUCTION_SUPABASE_REF",
  "SITE_URL",
  "BFF_ALLOWED_ORIGINS",
  "VITE_SUPABASE_URL",
  "SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "PASSKEY_RP_ID",
  "PASSKEY_ALLOWED_ORIGINS",
  "META_WA_ACCESS_TOKEN",
  "META_WA_PHONE_NUMBER_ID",
  "META_WA_WABA_ID",
  "META_WA_APP_SECRET",
  "META_WA_VERIFY_TOKEN",
  "META_WA_AUTH_TEMPLATE_NAME",
  "META_WA_GRAPH_API_VERSION",
  "GOOGLE_WALLET_ISSUER_ID",
  "GOOGLE_WALLET_CLASS_ID",
  "GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_WALLET_PRIVATE_KEY",
  "COMMIT_REF",
  "CONTEXT",
  "NETLIFY_CONTEXT",
] as const;

function readEnvironment() {
  return Object.fromEntries(
    variableNames.map((name) => [
      name,
      (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) ||
        process.env[name],
    ]),
  );
}

export default async (request: Request) => {
  if (!new Set(["GET", "HEAD"]).has(request.method))
    return secureJson({ error: "Método não permitido." }, 405);

  const readiness = buildHomologationReadiness(readEnvironment());
  if (!readiness.exposed)
    return secureJson({ error: "Recurso não encontrado." }, 404);

  if (request.method === "HEAD") {
    return new Response(null, {
      status: readiness.coreReady ? 204 : 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  return secureJson(readiness, readiness.coreReady ? 200 : 503);
};

export const config = { path: "/api/homologation-readiness" };
