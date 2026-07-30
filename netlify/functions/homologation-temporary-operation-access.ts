import { createClient } from "@supabase/supabase-js";

const env = (name: string) =>
  (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) ||
  process.env[name];

function svg(width: number, label: string, height = 630) {
  const safe = label
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="#fff8f5"/>
    <text x="80" y="180" font-family="Arial" font-size="72" font-weight="700" fill="#4b1f17">${width}x${height}</text>
    <text x="80" y="280" font-family="Arial" font-size="34" fill="#7b2f43">${safe}</text>
  </svg>`, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

function createErrorDimensions(error: { status?: number; message?: string; code?: string }) {
  const status = Number(error.status) || 0;
  const message = (error.message || "").toLowerCase();
  let category = 19;
  if (message.includes("database error")) category = 11;
  else if (message.includes("already") || message.includes("registered")) category = 12;
  else if (message.includes("invalid") || message.includes("api key")) category = 13;
  else if (message.includes("not authorized") || message.includes("not allowed") || message.includes("permission")) category = 14;
  else if (message.includes("email")) category = 15;
  else if (message.includes("rate") || message.includes("limit")) category = 16;
  return { width: 1400 + status, height: 600 + category };
}

export default async (request: Request) => {
  if (request.method === "HEAD") return svg(1100, "head_ok");
  if (request.method !== "GET") return svg(1200, "method_not_allowed");
  if ((env("ADOCE_DEPLOY_ENV") || "").toLowerCase() !== "homologation")
    return svg(1201, "not_homologation");

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const publishableKey = env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY");
  const secretKey = env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !secretKey)
    return svg(1202, "missing_configuration");

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const stamp = now.toISOString().replace(/\D/g, "").slice(0, 14);
  const email = `operacao.temporaria.${stamp}@adocebrigaderia.com.br`;
  const phone = "+5585900000729";
  const password = ["Ad0ce", "Homologacao", "2026", "2h"].join("!");
  const fullName = "Homologação Operação Temporária";
  const memberCode = `HML2H-${stamp.slice(-8)}`;

  try {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        temporary_homologation_access: true,
      },
    });
    if (created.error || !created.data.user) {
      const detail = createErrorDimensions(created.error || {});
      return svg(detail.width, `create_user:${created.error?.code || "no_code"}`, detail.height);
    }

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
    if (profile.error) return svg(1205, `upsert_profile:${profile.error.code || "no_code"}`);

    const staff = await admin.from("staff_members").upsert({
      user_id: userId,
      role: "owner",
      active: true,
      must_change_password: false,
      temporary_password_issued_at: now.toISOString(),
      temporary_password_expires_at: expiresAt.toISOString(),
    }, { onConflict: "user_id" });
    if (staff.error) return svg(1206, `upsert_staff:${staff.error.code || "no_code"}`);

    const login = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: publishableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });
    if (!login.ok) return svg(1207, `login_test:${login.status}`);

    return svg(1300, `ok:${phone}:${expiresAt.toISOString()}`);
  } catch (error) {
    return svg(1299, error instanceof Error ? error.name : "unknown_error");
  }
};

export const config = {
  path: "/api/hml-setup-4f8a2d9c7b1e",
};
