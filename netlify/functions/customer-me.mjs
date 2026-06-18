import { json, loadCustomerBundle, requireCustomer } from './_supabase-beta.mjs';

export async function handler(event) {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Metodo nao permitido.' });
  try {
    const auth = await requireCustomer(event);
    if (auth.error) return auth.error;
    return json(200, await loadCustomerBundle(auth.supabase, auth.customerId));
  } catch (error) {
    return json(500, { error: error.message || 'Erro ao carregar cadastro.' });
  }
}
