import { checkRateLimit, getAdmin, json, loadCustomerBundle, newToken, parseBody, phoneDigits, requestIp, tokenHash, verifyPassword } from './_supabase-beta.mjs';

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Metodo nao permitido.' });
  try {
    const body = parseBody(event);
    const digits = phoneDigits(body.whatsapp);
    const supabase = getAdmin();
    const allowed = await checkRateLimit(supabase, `customer-login:${requestIp(event)}:${digits}`, 10, 15);
    if (!allowed) return json(429, { error: 'Muitas tentativas de login. Aguarde alguns minutos.' });
    const { data: customer, error } = await supabase
      .from('beta_customers')
      .select('id,password_salt,password_hash')
      .eq('whatsapp_digits', digits)
      .single();
    if (error || !customer || !verifyPassword(body.password || '', customer.password_salt, customer.password_hash)) {
      return json(401, { error: 'WhatsApp ou senha nao conferem.' });
    }
    const token = newToken();
    await supabase.from('beta_customer_sessions').insert({
      token_hash: tokenHash(token),
      customer_id: customer.id,
      user_agent: event.headers['user-agent'] || null,
    });
    await supabase.from('beta_customers').update({ last_login_at: new Date().toISOString() }).eq('id', customer.id);
    const bundle = await loadCustomerBundle(supabase, customer.id);
    return json(200, { token, ...bundle });
  } catch (error) {
    return json(500, { error: error.message || 'Erro ao entrar.' });
  }
}
