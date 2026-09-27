import type { SupabaseClient } from "@supabase/supabase-js";

// Cadastro de cliente feito no balcão (Caixa/Atendimento). Usado pelo cadastro
// rápido e pelo cadastro no fechamento da venda. Não envia mensagem: quem chama
// decide qual WhatsApp mandar.

export type CounterCustomer = {
  profileId: string;
  accountId: string | null;
  fullName: string;
  phone: string;
  existing: boolean;
  fallbackEmail: string;
  temporaryPassword?: string;
};

export class CounterCustomerError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

// Antes eram os 6 últimos dígitos de um único uint32 (~1 milhão de espaço).
// Só dígitos — o balcão lê em voz alta pro cliente decorar até trocar no
// primeiro acesso.
const generateTemporaryPassword = () => {
  const digits = crypto.getRandomValues(new Uint32Array(8));
  return Array.from(digits, (value) => String(value % 10)).join("");
};

export const hasFullName = (fullName: string) =>
  fullName.trim().split(/\s+/).filter((part) => part.length > 1).length >= 2;

export async function findOrCreateCounterCustomer(
  admin: SupabaseClient,
  actorUserId: string,
  rawFullName: string,
  phone: string,
): Promise<CounterCustomer> {
  const fullName = rawFullName.trim().replace(/\s+/g, " ");
  const fallbackEmail = `${phone.replace(/\D/g, "")}@membro.adocebrigaderia.com.br`;

  const { data: existing } = await admin
    .from("profiles")
    .select("id,full_name,phone_e164")
    .eq("phone_e164", phone)
    .maybeSingle();
  if (existing?.id) {
    const { data: membership } = await admin
      .from("account_memberships")
      .select("account_id")
      .eq("profile_id", existing.id)
      .eq("active", true)
      .eq("is_primary", true)
      .maybeSingle();
    return {
      profileId: existing.id,
      accountId: membership?.account_id || null,
      fullName: existing.full_name,
      phone: existing.phone_e164,
      existing: true,
      fallbackEmail,
    };
  }

  const temporaryPassword = generateTemporaryPassword();
  const { data: createdData, error: createError } = await admin.auth.admin.createUser({
    email: fallbackEmail,
    email_confirm: true,
    phone,
    phone_confirm: true,
    password: temporaryPassword,
    user_metadata: { full_name: fullName, created_at_counter: true },
  });
  const createdUser = createdData?.user;
  if (createError || !createdUser) {
    // "already registered" quase sempre é o mesmo telefone/e-mail em conta
    // encerrada (soft-deleted) — a mensagem genérica escondia isso do atendente.
    const message = /already registered|already exists/i.test(createError?.message || "")
      ? "Este telefone já teve um cadastro encerrado. Fale com a Adoce para reativar em vez de criar outro."
      : "Não foi possível criar o cadastro.";
    throw new CounterCustomerError(message, 409);
  }

  const profileId = createdUser.id;
  const now = new Date().toISOString();
  await admin
    .from("profiles")
    .update({
      full_name: fullName,
      phone_e164: phone,
      auth_upgraded_at: now,
      must_change_password: true,
      updated_at: now,
    })
    .eq("id", profileId);

  await admin.from("consent_events").insert([
    { profile_id: profileId, consent_type: "club_terms", granted: true, document_version: "1.0", source: "operation_counter" },
    { profile_id: profileId, consent_type: "privacy", granted: true, document_version: "1.0", source: "operation_counter" },
  ]);

  const { data: membership } = await admin
    .from("account_memberships")
    .select("account_id")
    .eq("profile_id", profileId)
    .eq("active", true)
    .eq("is_primary", true)
    .maybeSingle();

  await admin.from("audit_events").insert({
    actor_user_id: actorUserId,
    action: "customer.created_at_counter",
    entity_type: "profile",
    entity_id: profileId,
    payload: { phone_suffix: phone.slice(-4), source: "operation_counter" },
  });

  return {
    profileId,
    accountId: membership?.account_id || null,
    fullName,
    phone,
    existing: false,
    fallbackEmail,
    temporaryPassword,
  };
}
