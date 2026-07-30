import { createClient } from "@supabase/supabase-js";

const env = (name: string) =>
  (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) ||
  process.env[name];

function svg(status: "OK" | "ERRO", detail: string, httpStatus: number) {
  const safe = detail
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <rect width="1200" height="630" fill="#fff8f5"/>
    <text x="80" y="180" font-family="Arial" font-size="72" font-weight="700" fill="#4b1f17">${status}</text>
    <text x="80" y="280" font-family="Arial" font-size="34" fill="#7b2f43">${safe}</text>
  </svg>`, {
    status: httpStatus,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

export default async (request: Request) => {
  if (request.method !== "GET") return svg("ERRO", "method_not_allowed", 405);
  if ((env("ADOCE_DEPLOY_ENV") || "").toLowerCase() !== "homologation")
    return svg("ERRO", "not_homologation", 404);

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const publishableKey = env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY");
  const secretKey = env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !secretKey)
    return svg("ERRO", "missing_configuration", 503);

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const fail = async (stage: string, detail: string, status = 500) => {
    await admin.from("operation_notifications").insert({
      event_type: "homologation.temp_access_error",
      priority: "important",
      title: "Diagnóstico temporário de acesso",
      message: stage,
      entity_type: "homologation_diagnostic",
      entity_id: "temporary-operation-access",
      action_url: "#operacao",
      metadata: { detail },
      push_status: "failed",
    }).catch(() => undefined);
    return svg("ERRO", stage, status);
  };

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const stamp = now.toISOString().replace(/\D/g, "").slice(0, 14);
  const email = `operacao.temporaria.${stamp}@adocebrigaderia.com.br`;
  const phone = "+5585900000000";
  const password = ["Ad0ce", "Homologacao", "2026", "2h"].join("!");
  const fullName = "Homologação Operação Temporária";
  const memberCode = `HML2H-${stamp.slice(-8)}`;

  try {
    const existing = await admin
      .from("profiles")
      .select("id")
      .eq("phone_e164", phone)
      .maybeSingle();

    if (existing.error)
      return await fail("lookup_existing", existing.error.message);

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
      return await fail("create_user", created.error?.message || "user_not_created");

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
    if (profile.error) return await fail("upsert_profile", profile.error.message);

    const staff = await admin.from("staff_members").upsert({
      user_id: userId,
      role: "owner",
      active: true,
      must_change_password: false,
      temporary_password_issued_at: now.toISOString(),
      temporary_password_expires_at: expiresAt.toISOString(),
    }, { onConflict: "user_id" });
    if (staff.error) return await fail("upsert_staff", staff.error.message);

    const login = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: publishableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });
    if (!login.ok) {
      const raw = await login.text().catch(() => "");
      return await fail("login_test", `${login.status}:${raw.slice(0, 300)}`);
    }

    return svg("OK", `phone=${phone};expires=${expiresAt.toISOString()}`, 200);
  } catch (error) {
    return await fail("unexpected", error instanceof Error ? error.message : "unknown_error");
  }
};

export const config = {
  path: "/api/hml-setup-4f8a2d9c7b1e",
};
