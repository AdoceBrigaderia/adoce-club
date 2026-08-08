import { createClient } from "@supabase/supabase-js";
import { ACCESS_COOKIE, SURFACE_COOKIE, allowedOrigin, parseCookies, secureJson, validCsrf } from "./_shared/session-security";

declare const Netlify: { env: { get(name: string): string | undefined } } | undefined;
const env = (name: string) => (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) || process.env[name];
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date());

export default async (request: Request) => {
  if (!allowedOrigin(request, env("SITE_URL"))) return secureJson({ error: "Origem não autorizada." }, 403);
  if (!["GET", "POST"].includes(request.method)) return secureJson({ error: "Método não permitido." }, 405);
  if (request.method === "POST" && !validCsrf(request)) return secureJson({ error: "Validação CSRF inválida." }, 403);
  const cookies = parseCookies(request);
  const accessToken = cookies.get(ACCESS_COOKIE) || "";
  if (!accessToken || cookies.get(SURFACE_COOKIE) !== "operation") return secureJson({ error: "Sessão operacional obrigatória." }, 401);
  const url = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const key = env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY");
  const secret = env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key || !secret) return secureJson({ error: "Serviço indisponível." }, 503);
  const session = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: user } = await session.auth.getUser(accessToken);
  if (!user.user) return secureJson({ error: "Sessão inválida." }, 401);
  const { data: staff } = await session.from("staff_members").select("active,role").eq("user_id", user.user.id).maybeSingle();
  if (!staff?.active) return secureJson({ error: "Acesso operacional obrigatório." }, 403);
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const date = today();
  if (request.method === "POST") {
    if (!["owner", "manager"].includes(staff.role)) return secureJson({ error: "Sem permissão para liberar produção." }, 403);
    const { data: menu, error } = await admin.from("weekly_service_menu").select("id,quantity_planned,quantity_released").eq("service_date", date).eq("channel_slug", "online_orders");
    if (error) return secureJson({ error: "Não foi possível carregar a produção." }, 500);
    const ids = (menu || []).filter((row) => Number(row.quantity_planned || 0) > Number(row.quantity_released || 0)).map((row) => row.id);
    if (!ids.length) return secureJson({ released: false });
    const released = await admin.rpc("staff_release_weekly_production", { release_date: date, release_item_ids: ids });
    if (released.error) return secureJson({ error: "Não foi possível liberar a produção." }, 400);
    return secureJson({ released: true });
  }
  const [menu, availability, orders, notifications] = await Promise.all([
    admin.from("weekly_service_menu").select("flavor_id,quantity_planned,quantity_released,flavors(name,base_price)").eq("service_date", date).eq("channel_slug", "online_orders"),
    admin.from("flavor_availability").select("flavor_id,quantity_available,quantity_reserved").eq("service_date", date),
    admin.from("instant_orders").select("id,order_number,customer_name,total,created_at,status,instant_order_items(quantity)").gte("created_at", `${date}T00:00:00-03:00`).lt("created_at", `${date}T23:59:59-03:00`),
    admin.from("operation_notifications").select("id", { count: "exact", head: true }).eq("push_status", "pending"),
  ]);
  if (menu.error || availability.error || orders.error || notifications.error) return secureJson({ error: "Não foi possível carregar o painel." }, 500);
  return secureJson({ date, menu: menu.data || [], availability: availability.data || [], orders: orders.data || [], pendingNotifications: notifications.count || 0 });
};
export const config = { path: "/api/operation-daily-panel" };
