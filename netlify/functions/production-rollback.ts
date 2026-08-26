import { createClient } from "@supabase/supabase-js";

declare const Netlify: { env: { get(name: string): string | undefined } } | undefined;

const env = (name: string) =>
  (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) || process.env[name];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

const maskedDeploy = (deployId: string) =>
  deployId.length > 12 ? `${deployId.slice(0, 6)}…${deployId.slice(-6)}` : "versão segura";

export default async (request: Request) => {
  if (request.method !== "GET" && request.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const authorization = request.headers.get("authorization") || "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!accessToken) return json({ error: "Sessão obrigatória." }, 401);

  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const supabaseKey = env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY");
  if (!supabaseUrl || !supabaseKey) return json({ error: "Supabase não configurado no servidor." }, 503);

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) return json({ error: "Sessão inválida ou expirada." }, 401);

  const { data: staff, error: staffError } = await supabase
    .from("staff_members")
    .select("role,active")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (staffError || !staff?.active || staff.role !== "owner") {
    return json({ error: "Apenas o proprietário pode restaurar a produção." }, 403);
  }

  const safeDeployId = env("NETLIFY_SAFE_DEPLOY_ID")?.trim() || "";
  const siteId = env("NETLIFY_SITE_ID")?.trim() || "";
  const netlifyToken = env("NETLIFY_AUTH_TOKEN")?.trim() || "";
  const configured = Boolean(safeDeployId && siteId && netlifyToken);

  if (request.method === "GET") {
    return json({
      configured,
      safeDeployLabel: configured ? `Deploy ${maskedDeploy(safeDeployId)}` : "não configurada neste ambiente",
    });
  }

  if (!configured) return json({ error: "A versão segura ainda não foi configurada no servidor." }, 503);
  const body = await request.json().catch(() => ({})) as { confirmation?: string };
  if (body.confirmation !== "RESTAURAR PRODUCAO") return json({ error: "Confirmação de segurança incorreta." }, 400);

  const { error: requestedAuditError } = await supabase.rpc("record_owner_production_rollback", {
    rollback_status: "requested",
    safe_deploy_id: safeDeployId,
    restored_deploy_id: null,
    failure_message: null,
  });
  if (requestedAuditError) {
    return json({ error: "A restauração foi bloqueada porque a auditoria não pôde ser registrada." }, 500);
  }

  const restoreResponse = await fetch(
    `https://api.netlify.com/api/v1/sites/${encodeURIComponent(siteId)}/deploys/${encodeURIComponent(safeDeployId)}/restore`,
    { method: "POST", headers: { Authorization: `Bearer ${netlifyToken}` } },
  );
  const restoreBody = await restoreResponse.json().catch(() => ({})) as { id?: string; message?: string };

  if (!restoreResponse.ok) {
    const failure = restoreBody.message || `Netlify respondeu com status ${restoreResponse.status}`;
    await supabase.rpc("record_owner_production_rollback", {
      rollback_status: "failed",
      safe_deploy_id: safeDeployId,
      restored_deploy_id: null,
      failure_message: failure.slice(0, 500),
    });
    return json({ error: `A restauração não foi concluída: ${failure}` }, 502);
  }

  const { error: completedAuditError } = await supabase.rpc("record_owner_production_rollback", {
    rollback_status: "completed",
    safe_deploy_id: safeDeployId,
    restored_deploy_id: restoreBody.id || safeDeployId,
    failure_message: null,
  });
  return json({
    ok: true,
    restoredDeployId: restoreBody.id || safeDeployId,
    auditRecorded: !completedAuditError,
  });
};

export const config = { path: "/api/production-rollback" };
