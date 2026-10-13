import twilio from "twilio";
import { env, hmacHex, normalizeBrazilPhone, serviceClient } from "./whatsapp-auth";

// Identifica o cliente de cada conversa do WhatsApp (telefone completo + nome).
// As conversas guardam só o HMAC do telefone. O número é descoberto uma vez,
// comparando o HMAC com clientes e pedidos conhecidos ou lendo a mensagem de
// origem na Twilio, e fica salvo em private.whatsapp_support_threads.phone_e164.

type Admin = NonNullable<ReturnType<typeof serviceClient>>;
type ContactRow = { id: string; phone_hmac: string; phone_e164: string | null; source_message_sid: string };
export type ThreadContact = { phone_e164: string | null; customer_name: string | null };

const phoneHash = (secret: string, phone: string) => hmacHex(secret, `phone:${phone}`);

// Caches da instância (a lista é consultada a cada poucos segundos pela operação).
let hashCache: { at: number; byHash: Map<string, string> } | null = null;
const twilioMisses = new Map<string, number>();
const CACHE_MS = 5 * 60 * 1000;

async function knownPhones(admin: Admin) {
  const [profiles, orders] = await Promise.all([
    admin.from("profiles").select("phone_e164").not("phone_e164", "is", null).limit(5000),
    admin.from("instant_orders").select("customer_phone").order("created_at", { ascending: false }).limit(3000),
  ]);
  const phones = new Set<string>();
  for (const row of (profiles.data || []) as Array<{ phone_e164: string | null }>) {
    const phone = normalizeBrazilPhone(row.phone_e164 || "");
    if (phone) phones.add(phone);
  }
  for (const row of (orders.data || []) as Array<{ customer_phone: string | null }>) {
    const phone = normalizeBrazilPhone(row.customer_phone || "");
    if (phone) phones.add(phone);
  }
  return [...phones];
}

async function phoneFromTwilio(sid: string) {
  const accountSid = env("TWILIO_ACCOUNT_SID") || "";
  const authToken = env("TWILIO_AUTH_TOKEN") || "";
  const official = env("TWILIO_WHATSAPP_FROM") || "";
  if (!accountSid || !authToken || !official || !sid) return null;
  const expectedOfficial = official.startsWith("whatsapp:") ? official : `whatsapp:${official}`;
  const client = twilio(accountSid, authToken, { autoRetry: false, timeout: 6000 });
  const original = await client.messages(sid).fetch();
  const customer = original.to === expectedOfficial ? original.from : original.from === expectedOfficial ? original.to : "";
  return normalizeBrazilPhone(String(customer || "").replace(/^whatsapp:/, ""));
}

async function namesFor(admin: Admin, phones: string[]) {
  const names = new Map<string, string>();
  if (!phones.length) return names;
  const nationals = phones.map((phone) => phone.slice(3));
  const [profiles, orders] = await Promise.all([
    admin.from("profiles").select("full_name,phone_e164").in("phone_e164", phones),
    admin
      .from("instant_orders")
      .select("customer_name,customer_phone,created_at")
      .in("customer_phone", [...phones, ...nationals])
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  for (const row of (profiles.data || []) as Array<{ full_name: string | null; phone_e164: string | null }>) {
    const phone = normalizeBrazilPhone(row.phone_e164 || "");
    if (phone && row.full_name?.trim()) names.set(phone, row.full_name.trim());
  }
  for (const row of (orders.data || []) as Array<{ customer_name: string | null; customer_phone: string | null }>) {
    const phone = normalizeBrazilPhone(row.customer_phone || "");
    if (phone && !names.has(phone) && row.customer_name?.trim()) names.set(phone, row.customer_name.trim());
  }
  return names;
}

export async function resolveThreadContacts(
  admin: Admin,
  threadIds: string[],
  { twilioLimit = 3 }: { twilioLimit?: number } = {},
): Promise<Map<string, ThreadContact>> {
  const result = new Map<string, ThreadContact>();
  if (!threadIds.length) return result;
  const secret = env("AUTH_RATE_LIMIT_HMAC_SECRET") || "";
  const { data, error } = await admin.rpc("server_whatsapp_thread_contacts", { requested_ids: threadIds });
  if (error || !Array.isArray(data)) return result;
  const rows = data as ContactRow[];
  const phones = new Map<string, string>();
  for (const row of rows) if (row.phone_e164) phones.set(row.id, row.phone_e164);

  const unresolved = rows.filter((row) => !row.phone_e164);
  if (unresolved.length && secret) {
    if (!hashCache || Date.now() - hashCache.at > CACHE_MS) {
      const byHash = new Map<string, string>();
      for (const phone of await knownPhones(admin)) byHash.set(await phoneHash(secret, phone), phone);
      hashCache = { at: Date.now(), byHash };
    }
    const byHash = hashCache.byHash;
    let twilioCalls = 0;
    for (const row of unresolved) {
      let phone = byHash.get(row.phone_hmac) || null;
      const lastMiss = twilioMisses.get(row.id) || 0;
      if (!phone && twilioCalls < twilioLimit && Date.now() - lastMiss > CACHE_MS) {
        twilioCalls += 1;
        phone = await phoneFromTwilio(row.source_message_sid).catch(() => null);
        // Só aceita o número da Twilio se ele bater com o HMAC guardado na conversa.
        if (phone && (await phoneHash(secret, phone)) !== row.phone_hmac) phone = null;
        if (!phone) twilioMisses.set(row.id, Date.now());
      }
      if (phone) {
        phones.set(row.id, phone);
        await admin.rpc("server_set_whatsapp_thread_phone", { requested_thread_id: row.id, requested_phone: phone });
      }
    }
  }

  const names = await namesFor(admin, [...new Set(phones.values())]);
  for (const id of threadIds) {
    const phone = phones.get(id) || null;
    result.set(id, { phone_e164: phone, customer_name: phone ? names.get(phone) || null : null });
  }
  return result;
}
