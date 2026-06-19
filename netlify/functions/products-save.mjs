import { checkRateLimit, json, parseBody, requireStaff } from './_supabase-beta.mjs';

function normalizedName(value = '') {
  return String(value)
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function shortName(value = '') {
  const clean = String(value).trim();
  return clean.slice(0, 22) || 'Fatia';
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Metodo nao permitido.' });
  try {
    const auth = await requireStaff(event);
    if (auth.error) return auth.error;
    const allowed = await checkRateLimit(auth.supabase, `products-save:${auth.operatorId}`, 80, 60);
    if (!allowed) return json(429, { error: 'Muitas edicoes de produto. Aguarde um pouco.' });

    const body = parseBody(event);
    const product = body.product || body;
    const name = String(product.name || '').trim();
    if (!name) return json(400, { error: 'Informe o nome do produto.' });
    const normalized = normalizedName(name);

    const payload = {
      name,
      normalized_name: normalized,
      short_name: shortName(product.shortName || product.short_name || name),
      image_url: product.imageUrl || product.image_url || null,
      active: product.active !== false,
    };

    const { data, error } = await auth.supabase
      .from('beta_products')
      .upsert(payload, { onConflict: 'normalized_name' })
      .select('id,name,short_name,image_url,active,created_at,updated_at')
      .single();
    if (error) throw error;
    return json(200, { product: data });
  } catch (error) {
    return json(500, { error: error.message || 'Erro ao salvar produto.' });
  }
}
