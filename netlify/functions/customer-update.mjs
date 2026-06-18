import { json, loadCustomerBundle, parseBody, requireCustomer } from './_supabase-beta.mjs';

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Metodo nao permitido.' });
  try {
    const auth = await requireCustomer(event);
    if (auth.error) return auth.error;
    const body = parseBody(event);
    await auth.supabase.from('beta_customers').update({
      name: body.name,
      whatsapp: body.whatsapp,
      email: body.email || null,
      instagram: body.instagram || null,
      birth_date: body.birthDate || null,
      accepts_promotions: body.acceptsPromotions !== false,
      updated_at: new Date().toISOString(),
    }).eq('id', auth.customerId);
    return json(200, await loadCustomerBundle(auth.supabase, auth.customerId));
  } catch (error) {
    return json(500, { error: error.message || 'Erro ao salvar perfil.' });
  }
}
