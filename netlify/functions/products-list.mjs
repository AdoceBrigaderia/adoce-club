import { json, requireStaff } from './_supabase-beta.mjs';

export async function handler(event) {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Metodo nao permitido.' });
  try {
    const auth = await requireStaff(event);
    if (auth.error) return auth.error;
    const { data, error } = await auth.supabase
      .from('beta_products')
      .select('id,name,short_name,image_url,active,created_at,updated_at')
      .order('name', { ascending: true });
    if (error) throw error;
    return json(200, { products: data || [] });
  } catch (error) {
    return json(500, { error: error.message || 'Erro ao carregar produtos.' });
  }
}
