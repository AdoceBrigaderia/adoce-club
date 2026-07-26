import {
  ACCESS_COOKIE,
  allowedOrigin,
  clearedSessionCookies,
  parseCookies,
  secureJson,
  validCsrf,
} from "./_shared/session-security";

declare const Netlify:
  | { env: { get(name: string): string | undefined } }
  | undefined;

const env = (name: string) =>
  (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) ||
  process.env[name];

export default async (request: Request) => {
  if (request.method !== "POST")
    return secureJson({ error: "Método não permitido." }, 405);
  if (!allowedOrigin(request, env("SITE_URL")))
    return secureJson({ error: "Origem não autorizada." }, 403);
  if (!validCsrf(request))
    return secureJson({ error: "Validação de segurança inválida." }, 403);

  const cookies = parseCookies(request);
  const accessToken = cookies.get(ACCESS_COOKIE) || "";
  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const publishableKey =
    env("SUPABASE_PUBLISHABLE_KEY") ||
    env("VITE_SUPABASE_PUBLISHABLE_KEY");

  if (accessToken && supabaseUrl && publishableKey) {
    await fetch(`${supabaseUrl}/auth/v1/logout?scope=global`, {
      method: "POST",
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${accessToken}`,
      },
    }).catch(() => undefined);
  }

  return secureJson(
    { authenticated: false, loggedOut: true },
    200,
    clearedSessionCookies(),
  );
};

export const config = { path: "/api/auth-bff-logout" };
