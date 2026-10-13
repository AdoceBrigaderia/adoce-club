import { sendStampMessage } from "./_shared/loyalty-messages";
import { authorizeCounterStaffRequest, json, serviceClient } from "./_shared/whatsapp-auth";

export default async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const admin = serviceClient();
  if (!admin) return json({ error: "Aviso de carimbos não configurado." }, 503);

  // Atendimento também lança carimbos no balcão, então também pode avisar o cliente.
  const authorization = await authorizeCounterStaffRequest(request, admin);
  if (authorization.errorResponse) return authorization.errorResponse;
  if (!authorization.actorUserId) return json({ error: "Operador inválido." }, 403);

  const payload = (await request.json().catch(() => ({}))) as {
    profileId?: string;
    stampsAdded?: number;
    progress?: number;
    newRewards?: number;
  };
  const profileId = String(payload.profileId || "");
  const stampsAdded = Number(payload.stampsAdded || 0);
  const progress = Number(payload.progress || 0);
  const newRewards = Number(payload.newRewards || 0);
  if (!profileId || !Number.isInteger(stampsAdded) || stampsAdded < 1 || stampsAdded > 50 || !Number.isInteger(progress)) {
    return json({ error: "Atualização de carimbos inválida." }, 400);
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("full_name,phone_e164")
    .eq("id", profileId)
    .maybeSingle();
  if (profileError || !profile?.phone_e164) return json({ error: "Cliente sem WhatsApp cadastrado." }, 409);

  const result = await sendStampMessage(admin, {
    fullName: profile.full_name || "cliente",
    phone: profile.phone_e164,
    stampsAdded,
    progress,
    newRewards,
    actorUserId: authorization.actorUserId,
  });
  if (!result.ok) return json({ error: result.error }, /modelo aprovado/.test(result.error) ? 409 : 502);
  return json({ ok: true, status: "accepted" });
};

export const config = { path: "/api/loyalty/stamp-message", timeout: 20 };
