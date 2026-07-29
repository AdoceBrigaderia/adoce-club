import {
  ACCESS_COOKIE,
  clearedSessionCookies,
  parseCookies,
  secureJson,
} from "./_shared/session-security";
import { guardBffRequest } from "./_shared/request-security";

declare const Netlify:
  | { env: { get(name: string): string | undefined } }
  | undefined;

const env = (name: string) =>
  (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) ||
  process.env[name];

export default async (request: Request) => {
  const guardResponse = guardBffRequest(request, {
    methods: ["POST"],
    configuredSiteUrl: env("SITE_URL"),
    requireCsrf: true,
  });
  if (guardResponse) return guardResponse;

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
