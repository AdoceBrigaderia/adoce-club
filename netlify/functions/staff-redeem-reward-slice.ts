import { createClient } from "@supabase/supabase-js";
import { allowedOrigin, env, isUuid, json } from "./_shared/whatsapp-auth";

const allowedRoles = new Set(["owner", "manager", "attendant"]);

export default async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  if (!allowedOrigin(request)) return json({ error: "Origem não autorizada." }, 403);

  const accessToken = (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!accessToken) return json({ error: "Sessão obrigatória." }, 401);

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const publishableKey = env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY");
  if (!supabaseUrl || !publishableKey) {
    return json({ error: "Resgate da fatia-presente não configurado no servidor." }, 503);
  }

  // Passa a sessão do próprio atendente pro banco em vez da chave de
  // serviço: a função server_staff_redeem_reward_slice já confere
  // private.is_staff() e aplica tudo — reserva do prêmio, ledger, baixa do
  // sabor escolhido — numa única transação com "for update", em vez das
  // ~13 gravações soltas de antes (sem transação, com risco de venda
  // duplicada da última fatia entre dois atendimentos simultâneos).
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
  if (!isUuid(rewardId) || !isUuid(profileId) || !isUuid(flavorId)) {
    return json({ error: "Informe o cliente, o presente e o sabor entregue." }, 400);
  }

  // O dono deste prêmio é conferido pela RPC pra idempotência (mesma chave
  // de reward_id) e pela própria RLS de leitura de rewards; profileId aqui
  // só confirma o cliente certo antes de chamar a função.
  const { data: membership } = await sessionClient
    .from("account_memberships")
    .select("account_id")
    .eq("profile_id", profileId)
    .eq("active", true)
    .maybeSingle();
  const { data: reward } = await sessionClient
    .from("rewards")
    .select("track_id")
    .eq("id", rewardId)
    .maybeSingle();
  const { data: track } = reward
    ? await sessionClient.from("loyalty_tracks").select("account_id").eq("id", reward.track_id).maybeSingle()
    : { data: null };
  if (!reward || !track || !membership || membership.account_id !== track.account_id) {
    return json({ error: "Este presente não pertence a este cliente." }, 409);
  }

  const idempotencyKey = `counter-reward-slice:${rewardId}`;
  const { data, error } = await sessionClient.rpc("staff_redeem_reward_slice", {
    reward_id: rewardId,
    flavor_id: flavorId,
    idempotency_key: idempotencyKey,
  });
  if (error) {
    const message = /não está disponível hoje|não há unidade/i.test(error.message)
      ? error.message
      : /prêmio indisponível|já foi usado/i.test(error.message)
        ? "Este presente já foi usado."
        : /sabor não encontrado/i.test(error.message)
          ? "Sabor não encontrado."
          : "Não foi possível registrar o resgate do presente.";
    return json({ error: message }, 409);
  }

  return json({
    redeemed: true,
    flavorId: data.flavor_id,
    flavorName: data.flavor_name,
    already: Boolean(data.already),
  });
};

export const config = { path: "/api/staff-redeem-reward-slice" };
