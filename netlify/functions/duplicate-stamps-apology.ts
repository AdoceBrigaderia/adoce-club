import twilio from "twilio";
import { allowedOrigin, authorizeStaffRequest, env, json, serviceClient } from "./_shared/whatsapp-auth";
import { messageCreatePayload } from "./_shared/whatsapp-approved-templates";
import { loadApology } from "./_shared/duplicate-stamps-apology-data";
import { runApologyBatch, type ApologyRecipient } from "./_shared/duplicate-stamps-apology";

// TEMPORARIO. Sem schedule, sem retry. Remover apos conciliacao e autorizacao.
export default async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  if (!allowedOrigin(request)) return json({ error: "Origem não autorizada." }, 403);
  const admin = serviceClient();
  if (!admin) return json({ error: "Servidor não configurado." }, 503);
  const auth = await authorizeStaffRequest(request, admin);
  if (auth.errorResponse) return auth.errorResponse;
  const staff = await admin.from("staff_members").select("role,active").eq("user_id", auth.actorUserId!).maybeSingle();
  if (staff.error || !staff.data?.active || staff.data.role !== "owner") return json({ error: "Somente o proprietário." }, 403);
  const body = await request.json().catch(() => null);
  if (!body || (body.mode !== "preview" && body.mode !== "send" && body.mode !== undefined)) return json({ error: "Modo inválido." }, 400);
  try {
    const { recipients, ...summary } = await loadApology(admin);
    if (body.mode !== "send") return json({ mode: "preview", ...summary });
    if (body.confirmation !== "duplicate-stamps-2026-10:send") return json({ error: "Confirmação de envio obrigatória." }, 400);
    const account = env("TWILIO_ACCOUNT_SID") || "";
    const token = env("TWILIO_AUTH_TOKEN") || "";
    const from = (env("TWILIO_WHATSAPP_FROM") || "").replace(/^whatsapp:/, "");
    const contentSid = env("TWILIO_SUPPORT_MESSAGE_CONTENT_SID") || "";
    if (!account || !token || !/^\+[1-9]\d{7,14}$/.test(from) || !/^HX[0-9a-f]{32}$/i.test(contentSid)) return json({ error: "WhatsApp não configurado." }, 503);
    const client = twilio(account, token, { autoRetry: false, timeout: 8000 });
    const audit = async (row: ApologyRecipient, action: string, payload: Record<string, unknown>) => {
      const result = await admin.from("audit_events").insert({ actor_user_id: auth.actorUserId,
        action, entity_type: "loyalty_track", entity_id: row.track_id, payload });
      if (result.error) throw new Error("audit_write_failed");
    };
    const result = await runApologyBatch(recipients, {
      now: Date.now,
      claim: async row => {
        const claim = await admin.rpc("server_claim_duplicate_stamp_apology", { requested_track_id: row.track_id, requested_actor_id: auth.actorUserId });
        if (claim.error || typeof claim.data !== "boolean") throw new Error("claim_failed");
        return claim.data;
      },
      send: async (row, text) => {
        const message = await client.messages.create({ from: `whatsapp:${from}`, to: `whatsapp:${row.phone_e164}`,
          ...messageCreatePayload({ mode: "template", template: { contentSid, contentVariables: { "1": text } } }) });
        return message.sid;
      },
      sent: (row, sid) => audit(row, "stamps.duplicate_apology_sent", { message_sid: sid, current_progress: row.current_progress, reversed_reward: row.reversed_reward }),
      failed: async (row, reason, sid) => {
        // SID permite conciliar aceite sem repetir mensagem, mesmo se banco estiver indisponivel.
        console.error("duplicate_apology_failed", { track_id: row.track_id, reason, message_sid: sid });
        await audit(row, "stamps.duplicate_apology_failed", { reason, message_sid: sid, automatic_retry: false });
      },
    });
    return json({ mode: "send", ...result });
  } catch {
    return json({ error: "Execução interrompida. Confira a auditoria e as reservas antes de continuar." }, 503);
  }
};

export const config = { path: "/api/duplicate-stamps-apology" };
