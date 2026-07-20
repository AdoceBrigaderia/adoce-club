import { createClient } from "@supabase/supabase-js";

declare const Netlify: { env: { get(name: string): string | undefined } } | undefined;
const env = (name: string) =>
  (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) || process.env[name];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});
const clean = (value: unknown, max: number) => String(value || "").trim().slice(0, max);
const categories = new Set(["problem", "complaint", "suggestion", "compliment"]);

export default async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const origin = request.headers.get("origin");
  if (origin && !new Set([
    "https://www.adocebrigaderia.com.br",
    "https://clube.adocebrigaderia.com.br",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]).has(origin)) return json({ error: "Origem não autorizada." }, 403);

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const name = clean(body.name, 120);
  const email = clean(body.email, 200).toLowerCase();
  const phone = clean(body.phone, 24);
  const category = clean(body.category, 20);
  const message = clean(body.message, 3000);
  const pageUrl = clean(body.page_url, 500);
  if (name.length < 2 || message.length < 10 || !categories.has(category))
    return json({ error: "Informe seu nome, o tipo e detalhes do que aconteceu." }, 400);
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return json({ error: "Informe um e-mail válido." }, 400);

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const secretKey = env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !secretKey) return json({ error: "Canal temporariamente indisponível." }, 503);
  const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

  let profileId: string | null = null;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (token) {
    const { data } = await admin.auth.getUser(token);
    profileId = data.user?.id || null;
  }
  const protocol = `ADO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const { error } = await admin.from("site_feedback").insert({
    protocol,
    profile_id: profileId,
    category,
    customer_name: name,
    customer_email: email || null,
    customer_phone: phone || null,
    page_url: pageUrl,
    message,
  });
  if (error) return json({ error: "Não foi possível registrar agora. Tente novamente." }, 500);
  return json({ protocol }, 201);
};

export const config = { path: "/api/site-feedback" };
