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

export default async (request: Request) => {
  if (request.method !== "GET")
    return new Response("Not found", { status: 404 });

  if ((env("ADOCE_DEPLOY_ENV") || "").toLowerCase() !== "homologation")
    return new Response("Not found", { status: 404 });

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const secretKey = env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !secretKey)
    return Response.json({ ok: false, error: "missing_configuration" }, { status: 503 });

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
    return Response.json({ ok: false, error: created.error?.message || "user_not_created" }, { status: 500 });

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
    return Response.json({ ok: false, error: profile.error.message }, { status: 500 });

  const staff = await admin.from("staff_members").upsert({
    user_id: userId,
    role: "owner",
    active: true,
    must_change_password: false,
    temporary_password_issued_at: now.toISOString(),
    temporary_password_expires_at: expiresAt.toISOString(),
  }, { onConflict: "user_id" });

  if (staff.error)
    return Response.json({ ok: false, error: staff.error.message }, { status: 500 });

  return Response.json({
    ok: true,
    phone,
    password,
    expiresAt: expiresAt.toISOString(),
    userId,
  }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
};

export const config = {
  path: "/api/hml-setup-4f8a2d9c7b1e",
};
