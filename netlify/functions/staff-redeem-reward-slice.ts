import { createClient } from "@supabase/supabase-js";

declare const Netlify: { env: { get(name: string): string | undefined } } | undefined;

const env = (name: string) =>
  (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) ||
  process.env[name];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

const allowedRoles = new Set(["owner", "manager", "attendant"]);

const allowedOrigin = (request: Request) => {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const configured = env("SITE_URL")?.replace(/\/$/, "");
  return new Set(
    [
      configured,
      "https://www.adocebrigaderia.com.br",
      "https://clube.adocebrigaderia.com.br",
      "https://operacao.adocebrigaderia.com.br",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:4182",
      "http://127.0.0.1:4182",
    ].filter(Boolean),
  ).has(origin);
};

const todayInFortaleza = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date());

const currentTimeInFortaleza = () =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Fortaleza",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());

export default async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  if (!allowedOrigin(request)) return json({ error: "Origem não autorizada." }, 403);

  const authorization = request.headers.get("authorization") || "";
  const accessToken = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
  if (!accessToken) return json({ error: "Sessão obrigatória." }, 401);

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const publishableKey = env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY");
  const secretKey = env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !secretKey) {
    return json({ error: "Resgate da fatia-presente não configurado no servidor." }, 503);
  }

  const sessionClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await sessionClient.auth.getUser(accessToken);
  if (userError || !userData.user) return json({ error: "Sessão inválida ou expirada." }, 401);

  const { data: staff, error: staffError } = await sessionClient
    .from("staff_members")
    .select("role,active")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (staffError || !staff?.active || !allowedRoles.has(staff.role)) {
    return json({ error: "Seu perfil não pode resgatar fatia-presente." }, 403);
  }

  const body = (await request.json().catch(() => ({}))) as {
    rewardId?: string;
    profileId?: string;
    flavorId?: string;
  };
  const rewardId = body.rewardId?.trim() || "";
  const profileId = body.profileId?.trim() || "";
  const flavorId = body.flavorId?.trim() || "";
  if (!/^[0-9a-f-]{36}$/i.test(rewardId) || !/^[0-9a-f-]{36}$/i.test(profileId) || !/^[0-9a-f-]{36}$/i.test(flavorId)) {
    return json({ error: "Informe o cliente, o presente e o sabor entregue." }, 400);
  }

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const today = todayInFortaleza();
  const { data: availability, error: availabilityError } = await admin
    .from("flavor_availability")
    .select("id,flavor_id,status,quantity_available,quantity_reserved")
    .eq("flavor_id", flavorId)
    .eq("service_date", today)
    .maybeSingle();
  if (availabilityError) return json({ error: "Não foi possível conferir o estoque deste sabor." }, 500);
  if (!availability || !["available", "last_units"].includes(availability.status)) {
    return json({ error: "Este sabor não está disponível hoje para baixar o presente." }, 409);
  }
  if (availability.quantity_available != null) {
    const remaining =
      Number(availability.quantity_available) - Number(availability.quantity_reserved || 0);
    if (remaining < 1) {
      return json({ error: "Não há unidade deste sabor para baixar a fatia-presente." }, 409);
    }
  }

  const { data: flavor } = await admin
    .from("flavors")
    .select("id,name")
    .eq("id", flavorId)
    .maybeSingle();
  if (!flavor?.id) return json({ error: "Sabor não encontrado." }, 404);

  const { data: reward, error: rewardError } = await admin
    .from("rewards")
    .select("id,track_id,status,redemption_idempotency_key")
    .eq("id", rewardId)
    .maybeSingle();
  if (rewardError || !reward) return json({ error: "Prêmio não encontrado." }, 404);
  const operationKey = `counter-reward:${rewardId}`;
  if (reward.redemption_idempotency_key === operationKey && reward.status === "redeemed") {
    return json({ redeemed: true, flavorId: flavor.id, flavorName: flavor.name, already: true });
  }
  if (reward.status !== "available") return json({ error: "Este presente já foi usado." }, 409);

  const { data: membership } = await admin
    .from("account_memberships")
    .select("account_id")
    .eq("profile_id", profileId)
    .eq("active", true)
    .maybeSingle();
  const { data: track } = await admin
    .from("loyalty_tracks")
    .select("id,account_id,current_progress,completed_cards,redeemed_rewards")
    .eq("id", reward.track_id)
    .maybeSingle();
  if (!track || !membership || membership.account_id !== track.account_id) {
    return json({ error: "Este presente não pertence a este cliente." }, 409);
  }

  const { error: redeemError } = await admin
    .from("rewards")
    .update({
      status: "redeemed",
      redeemed_at: new Date().toISOString(),
      redeemed_by: userData.user.id,
      premium_upgrade: false,
      price_difference: 0,
      redemption_idempotency_key: operationKey,
    })
    .eq("id", rewardId)
    .eq("status", "available");
  if (redeemError) {
    return json({ error: redeemError.message || "Não foi possível registrar o resgate do presente." }, 409);
  }
  await admin
    .from("loyalty_tracks")
    .update({
      redeemed_rewards: Number(track.redeemed_rewards || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", track.id);
  await admin.from("ledger_entries").insert({
    track_id: track.id,
    subject_profile_id: profileId,
    actor_user_id: userData.user.id,
    reason: "reward_redeemed",
    stamps_delta: 0,
    resulting_progress: track.current_progress,
    resulting_completed_cards: track.completed_cards,
    idempotency_key: operationKey,
    metadata: { reward_id: rewardId, flavor_id: flavorId, source: "operation_counter" },
  });

  if (availability.quantity_available != null) {
    const nextAvailable = Math.max(0, Number(availability.quantity_available) - 1);
    const nextReserved = Math.max(0, Number(availability.quantity_reserved || 0));
    const { error: stockError } = await admin
      .from("flavor_availability")
      .update({
        quantity_available: nextAvailable,
        quantity_reserved: Math.min(nextReserved, nextAvailable),
        updated_at: new Date().toISOString(),
      })
      .eq("id", availability.id);
    if (stockError) {
      return json(
        { error: "O presente foi resgatado, mas o estoque precisa ser conferido neste sabor." },
        500,
      );
    }

    const nowTime = currentTimeInFortaleza();
    const { data: batches } = await admin
      .from("flavor_availability_batches")
      .select("id,quantity_available,quantity_reserved,available_from")
      .eq("flavor_id", flavorId)
      .eq("service_date", today)
      .eq("active", true)
      .order("available_from", { ascending: true });
    const batch = (batches || []).find((item) => {
      const free = Number(item.quantity_available) - Number(item.quantity_reserved || 0);
      return free >= 1 && String(item.available_from || "00:00").slice(0, 5) <= nowTime;
    }) || (batches || []).find((item) => Number(item.quantity_available) - Number(item.quantity_reserved || 0) >= 1);
    if (batch) {
      await admin
        .from("flavor_availability_batches")
        .update({
          quantity_available: Math.max(0, Number(batch.quantity_available) - 1),
          quantity_reserved: Math.min(
            Number(batch.quantity_reserved || 0),
            Math.max(0, Number(batch.quantity_available) - 1),
          ),
          updated_at: new Date().toISOString(),
        })
        .eq("id", batch.id);
    }
  }

  await admin.from("audit_events").insert({
    actor_user_id: userData.user.id,
    action: "loyalty.reward_redeemed_with_stock",
    entity_type: "reward",
    entity_id: rewardId,
    payload: { profile_id: profileId, flavor_id: flavorId, flavor_name: flavor.name, source: "operation_counter" },
  });

  return json({ redeemed: true, flavorId: flavor.id, flavorName: flavor.name });
};

export const config = { path: "/api/staff-redeem-reward-slice" };
