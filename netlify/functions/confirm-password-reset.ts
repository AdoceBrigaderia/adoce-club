import { json, serviceClient } from "./_shared/whatsapp-auth";

// request-password-reset.ts só envia o código; até 2026-09-04 ele também
// marcava must_change_password=true na hora do envio, antes de o código ser
// confirmado. Quem pedisse o código por engano (ou um terceiro pedindo pra
// perturbar) travava o próximo login normal na tela de troca de senha sem
// nunca ter trocado nada. Esta função marca a troca só depois que o código
// foi verificado e a sessão nova já existe — chamada pelo front logo após
// verifyWhatsAppAuthCode() ter sucesso no fluxo "esqueci a senha".
export default async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const accessToken = (request.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!accessToken) return json({ error: "Sessão obrigatória." }, 401);

  const admin = serviceClient();
  if (!admin) return json({ error: "Confirmação de senha não configurada no servidor." }, 503);

  const { data: userData, error: userError } = await admin.auth.getUser(accessToken);
  if (userError || !userData.user) return json({ error: "Sessão inválida ou expirada." }, 401);

  const now = new Date().toISOString();
  await Promise.all([
    admin.from("profiles").update({ must_change_password: true, updated_at: now }).eq("id", userData.user.id),
    admin.from("staff_members").update({ must_change_password: true }).eq("user_id", userData.user.id),
  ]);

  return json({ confirmed: true });
};

export const config = { path: "/api/confirm-password-reset" };
