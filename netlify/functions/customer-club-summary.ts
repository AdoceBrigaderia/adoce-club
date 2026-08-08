import { createClient } from "@supabase/supabase-js";
import { ACCESS_COOKIE, allowedOrigin, parseCookies, secureJson } from "./_shared/session-security";

declare const Netlify: { env: { get(name: string): string | undefined } } | undefined;

const env = (name: string) =>
  (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) || process.env[name];

export default async (request: Request) => {
  if (request.method !== "GET") return secureJson({ error: "Método não permitido." }, 405);
  if (!allowedOrigin(request, env("SITE_URL"))) return secureJson({ error: "Origem não autorizada." }, 403);

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const publishableKey = env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY");
  const secretKey = env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  const accessToken = parseCookies(request).get(ACCESS_COOKIE) || "";
  if (!supabaseUrl || !publishableKey || !secretKey) {
    return secureJson({ error: "Clube temporariamente indisponível." }, 503);
  }
  if (!accessToken) return secureJson({ error: "Sessão ausente." }, 401);

  const sessionClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await sessionClient.auth.getUser(accessToken);
  if (userError || !userData.user) return secureJson({ error: "Sessão inválida ou expirada." }, 401);

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const [{ data: profile }, { data: memberships }] = await Promise.all([
    admin.from("profiles").select("full_name,member_code,active,account_status").eq("id", userData.user.id).maybeSingle(),
    admin.from("account_memberships").select("account_id,is_primary").eq("profile_id", userData.user.id).eq("active", true),
  ]);
  if (!profile?.active || profile.account_status !== "active") {
    return secureJson({ error: "Conta indisponível." }, 403);
  }
  const accountId = memberships?.find((membership) => membership.is_primary)?.account_id || memberships?.[0]?.account_id;
  if (!accountId) return secureJson({ error: "Conta não encontrada." }, 404);

  const { data: tracks } = await admin
    .from("loyalty_tracks")
    .select("id,kind,current_progress")
    .eq("account_id", accountId);
  const mainTrack = tracks?.find((track) => track.kind === "main");
  const referralTrack = tracks?.find((track) => track.kind === "referral");
  const { count: rewards } = mainTrack
    ? await admin.from("rewards").select("id", { count: "exact", head: true }).eq("track_id", mainTrack.id).eq("status", "available")
    : { count: 0 };

  return secureJson({
    firstName: String(profile.full_name || "Cliente Adoce").trim().split(/\s+/)[0] || "Cliente",
    memberCode: String(profile.member_code || ""),
    progress: Number(mainTrack?.current_progress || 0),
    completedCycles: Math.floor(Number(mainTrack?.current_progress || 0) / 14),
    referralProgress: Number(referralTrack?.current_progress || 0),
    rewards: Number(rewards || 0),
  });
};

export const config = { path: "/api/customer-club-summary" };
