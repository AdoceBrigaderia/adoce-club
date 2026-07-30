import { createClient } from "@supabase/supabase-js";

const env = (name: string) =>
  (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) ||
  process.env[name];

function randomPassword() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (value) => value.toString(36)).join("");
  return `Ad0ce!${token.slice(0, 18)}2h`;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function credentialImage(data: {
  status: "OK" | "ERRO";
  phone?: string;
  password?: string;
  expiresAt?: string;
  error?: string;
}) {
  const phone = escapeXml(data.phone || "-");
  const password = escapeXml(data.password || "-");
  const expiresAt = escapeXml(data.expiresAt || "-");
  const error = escapeXml(data.error || "-");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <rect width="1200" height="630" fill="#fff8f5"/>
    <rect x="50" y="50" width="1100" height="530" rx="30" fill="#ffffff" stroke="#7b2f43" stroke-width="4"/>
    <text x="100" y="135" font-family="Arial, sans-serif" font-size="50" font-weight="700" fill="#4b1f17">Adoce — acesso temporário</text>
    <text x="100" y="205" font-family="Arial, sans-serif" font-size="34" fill="#7b2f43">Status: ${data.status}</text>
    <text x="100" y="285" font-family="Arial, sans-serif" font-size="32" fill="#4b1f17">Celular: ${phone}</text>
    <text x="100" y="350" font-family="Arial, sans-serif" font-size="32" fill="#4b1f17">Senha: ${password}</text>
    <text x="100" y="415" font-family="Arial, sans-serif" font-size="28" fill="#4b1f17">Expira em: ${expiresAt}</text>
    <text x="100" y="485" font-family="Arial, sans-serif" font-size="24" fill="#8c5a50">Erro: ${error}</text>
    <text x="100" y="540" font-family="Arial, sans-serif" font-size="22" fill="#8c5a50">Somente homologação. Endpoint descartável.</text>
  </svg>`;
  return new Response(svg, {
    status: data.status === "OK" ? 200 : 500,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

export default async (request: Request) => {
  if (request.method !== "GET")
    return new Response("Not found", { status: 404 });

  if ((env("ADOCE_DEPLOY_ENV") || "").toLowerCase() !== "homologation")
    return new Response("Not found", { status: 404 });

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const secretKey = env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !secretKey)
    return credentialImage({ status: "ERRO", error: "missing_configuration" });

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const stamp = now.toISOString().replace(/\D/g, "").slice(0, 14);
  const email = `operacao-temporaria-${stamp}@example.invalid`;
  const phone = "+5585900000000";
  const password = randomPassword();
  const fullName = "Homologação Operação Temporária";
  const memberCode = `HML2H-${stamp.slice(-8)}`;

  const existing = await admin
    .from("profiles")
    .select("id")
    .eq("phone_e164", phone)
    .maybeSingle();

  if (existing.data?.id) {
    await admin.from("staff_members").update({ active: false }).eq("user_id", existing.data.id);
    await admin.from("profiles").update({ active: false, account_status: "inactive" }).eq("id", existing.data.id);
  }

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      temporary_homologation_access: true,
    },
  });

  if (created.error || !created.data.user)
    return credentialImage({
      status: "ERRO",
      error: created.error?.message || "user_not_created",
    });

  const userId = created.data.user.id;
  const profile = await admin.from("profiles").upsert({
    id: userId,
    full_name: fullName,
    phone_e164: phone,
    email,
    active: true,
    account_status: "active",
    member_code: memberCode,
    auth_upgraded_at: now.toISOString(),
    must_change_password: false,
    temporary_password_issued_at: now.toISOString(),
    temporary_password_expires_at: expiresAt.toISOString(),
    updated_at: now.toISOString(),
  }, { onConflict: "id" });

  if (profile.error)
    return credentialImage({ status: "ERRO", error: profile.error.message });

  const staff = await admin.from("staff_members").upsert({
    user_id: userId,
    role: "owner",
    active: true,
    must_change_password: false,
    temporary_password_issued_at: now.toISOString(),
    temporary_password_expires_at: expiresAt.toISOString(),
  }, { onConflict: "user_id" });

  if (staff.error)
    return credentialImage({ status: "ERRO", error: staff.error.message });

  return credentialImage({
    status: "OK",
    phone,
    password,
    expiresAt: expiresAt.toISOString(),
  });
};

export const config = {
  path: "/api/hml-setup-4f8a2d9c7b1e",
};
