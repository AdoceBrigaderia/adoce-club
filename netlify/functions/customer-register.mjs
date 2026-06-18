import { checkRateLimit, getAdmin, hashPassword, json, loadCustomerBundle, newToken, parseBody, phoneDigits, requestIp, tokenHash } from './_supabase-beta.mjs';

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Metodo nao permitido.' });
  try {
    const body = parseBody(event);
    const digits = phoneDigits(body.whatsapp);
    if (!body.name?.trim() || digits.length < 10 || String(body.password || '').length < 4) {
      return json(400, { error: 'Informe nome, WhatsApp valido e senha com pelo menos 4 caracteres.' });
    }
    if (!body.lgpdAccepted || !body.betaAccepted) return json(400, { error: 'Aceite LGPD e aviso beta para continuar.' });

    const supabase = getAdmin();
    const allowed = await checkRateLimit(supabase, `customer-register:${requestIp(event)}:${digits}`, 6, 30);
    if (!allowed) return json(429, { error: 'Muitas tentativas de cadastro. Aguarde alguns minutos.' });

    const existing = await supabase.from('beta_customers').select('id').eq('whatsapp_digits', digits).maybeSingle();
    if (existing.data) return json(409, { error: 'Este WhatsApp ja possui cadastro. Entre com sua senha.' });

    const password = hashPassword(body.password);
    const { data: customer, error } = await supabase.from('beta_customers').insert({
      name: body.name.trim(),
      whatsapp: body.whatsapp,
      whatsapp_digits: digits,
      email: body.email || null,
      instagram: body.instagram || null,
      birth_date: body.birthDate || null,
      password_salt: password.salt,
      password_hash: password.hash,
      lgpd_accepted_at: new Date().toISOString(),
      beta_accepted_at: new Date().toISOString(),
      accepts_promotions: body.acceptsPromotions !== false,
    }).select('id').single();
    if (error) throw error;

    await supabase.from('beta_loyalty_cards').insert({ customer_id: customer.id, stamps_required: 14 });
    const token = newToken();
    await supabase.from('beta_customer_sessions').insert({
      token_hash: tokenHash(token),
      customer_id: customer.id,
      user_agent: event.headers['user-agent'] || null,
    });
    const bundle = await loadCustomerBundle(supabase, customer.id);
    return json(200, { token, ...bundle });
  } catch (error) {
    return json(500, { error: error.message || 'Erro ao cadastrar.' });
  }
}
