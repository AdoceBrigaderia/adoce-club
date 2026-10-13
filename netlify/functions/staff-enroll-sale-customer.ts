import { createClient } from "@supabase/supabase-js";
import { generateAccessLink } from "./_shared/access-link";
import { CounterCustomerError, findOrCreateCounterCustomer, hasFullName } from "./_shared/counter-customer";
import { sendClubWelcome, sendStampMessage } from "./_shared/loyalty-messages";
import { allowedOrigin, authorizeCounterStaffRequest, env, json, normalizeBrazilPhone, serviceClient } from "./_shared/whatsapp-auth";

// Cadastro no Clube no fechamento da venda (opcional). Com nome, sobrenome e
// WhatsApp: cria (ou encontra) o cadastro, liga a venda ao cliente, lança um
// carimbo por fatia paga e avisa pelo WhatsApp oficial — boas-vindas com a
// explicação do programa e o link para criar a senha (só para cliente novo) e
// a mensagem de carimbos.

export default async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  if (!allowedOrigin(request)) return json({ error: "Origem não autorizada." }, 403);

  const admin = serviceClient();
  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const publishableKey = env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY");
  if (!admin || !supabaseUrl || !publishableKey) return json({ error: "Cadastro do balcão não configurado no servidor." }, 503);

  const authorization = await authorizeCounterStaffRequest(request, admin);
  if (authorization.errorResponse) return authorization.errorResponse;
  const actorUserId = authorization.actorUserId as string;

  const body = (await request.json().catch(() => ({}))) as { orderId?: string; fullName?: string; phone?: string };
  const orderId = String(body.orderId || "");
  const fullName = String(body.fullName || "").trim().replace(/\s+/g, " ");
  const phone = normalizeBrazilPhone(body.phone || "");
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return json({ error: "Venda inválida." }, 400);
  if (!hasFullName(fullName)) return json({ error: "Informe nome e sobrenome do cliente." }, 400);
  if (!phone) return json({ error: "Informe um WhatsApp com DDD." }, 400);

  const { data: order } = await admin
    .from("instant_orders")
    .select("id,order_number,status,created_at,store_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return json({ error: "Venda não encontrada." }, 404);
  if (order.status !== "completed") return json({ error: "Só é possível cadastrar em vendas concluídas." }, 409);
  if (Date.now() - new Date(order.created_at).getTime() > 36 * 60 * 60 * 1000) {
    return json({ error: "Esta venda é antiga. Lance os carimbos pelo Atendimento." }, 409);
  }
  const { data: previous } = await admin
    .from("audit_events")
    .select("id")
    .eq("action", "customer.enrolled_at_sale")
    .eq("entity_id", orderId)
    .limit(1);
  if (previous?.length) return json({ error: "Os carimbos desta venda já foram lançados." }, 409);

  const { data: items } = await admin
    .from("instant_order_items")
    .select("quantity,is_reward,status")
    .eq("order_id", orderId);
  const slices = (items || [])
    .filter((item) => !item.is_reward && !["cancelled", "unavailable"].includes(item.status))
    .reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  let customer;
  try {
    customer = await findOrCreateCounterCustomer(admin, actorUserId, fullName, phone);
  } catch (error) {
    if (error instanceof CounterCustomerError) return json({ error: error.message }, error.status);
    throw error;
  }
  if (!customer.accountId) return json({ error: "Cadastro criado, mas sem cartão do Clube. Fale com a Adoce." }, 409);

  // Liga a venda ao cliente (o gatilho do banco preenche profile_id pelo telefone).
  await admin.from("instant_orders")
    .update({ customer_name: customer.fullName.slice(0, 120), customer_phone: customer.phone, updated_at: new Date().toISOString() })
    .eq("id", orderId);

  // Carimbos lançados como o próprio atendente (mantém a auditoria de quem lançou).
  let progress = 0;
  let newRewards = 0;
  if (slices > 0) {
    const staffClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: `Bearer ${authorization.accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: purchase, error: purchaseError } = await staffClient.rpc("staff_record_purchase", {
      account_id: customer.accountId,
      participant_profile_id: customer.profileId,
      quantity: Math.min(slices, 30),
      idempotency_key: `sale-order:${orderId}`,
      referral_code: null,
    });
    if (purchaseError) return json({ error: `Cadastro feito, mas os carimbos não foram lançados: ${purchaseError.message}` }, 502);
    progress = Number(purchase?.progress || 0);
    newRewards = Number(purchase?.new_rewards || 0);
  }

  await admin.from("audit_events").insert({
    actor_user_id: actorUserId,
    action: "customer.enrolled_at_sale",
    entity_type: "instant_order",
    entity_id: orderId,
    payload: { order_number: order.order_number, profile_id: customer.profileId, new_customer: !customer.existing, stamps: slices },
  });

  const warnings: string[] = [];
  let welcomeSent = false;
  if (!customer.existing) {
    try {
      const access = await generateAccessLink(admin, customer.fallbackEmail);
      const welcome = await sendClubWelcome(admin, { fullName: customer.fullName, phone: customer.phone, stamps: slices, access, actorUserId });
      welcomeSent = welcome.ok;
      if (!welcome.ok) warnings.push(welcome.error);
    } catch {
      warnings.push("Cadastro criado, mas não foi possível gerar o link de acesso.");
    }
  }
  let stampsMessageSent = false;
  if (slices > 0) {
    const stamps = await sendStampMessage(admin, {
      fullName: customer.fullName, phone: customer.phone, stampsAdded: slices, progress, newRewards, actorUserId,
    });
    stampsMessageSent = stamps.ok;
    if (!stamps.ok) warnings.push(stamps.error);
  }

  return json({
    profileId: customer.profileId,
    fullName: customer.fullName,
    existing: customer.existing,
    stampsAdded: slices,
    progress,
    newRewards,
    welcomeSent,
    stampsMessageSent,
    // Senha temporária só se o WhatsApp falhar: o atendente dita para o cliente.
    temporaryPassword: !customer.existing && !welcomeSent ? customer.temporaryPassword : undefined,
    warnings,
  });
};

export const config = { path: "/api/staff-enroll-sale-customer", timeout: 26 };
