import { checkRateLimit, getAdmin, json, newToken, parseBody, requestIp, staffPins, tokenHash } from './_supabase-beta.mjs';

const operators = new Set(['rubens', 'beth']);

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Metodo nao permitido.' });
  try {
    const body = parseBody(event);
    const userId = String(body.userId || '').toLowerCase();
    const supabase = getAdmin();
    const allowed = await checkRateLimit(supabase, `staff-login:${requestIp(event)}:${userId}`, 8, 15);
    if (!allowed) return json(429, { error: 'Muitas tentativas. Aguarde alguns minutos.' });

    const pins = staffPins();
    if (!operators.has(userId) || pins[userId] !== String(body.pin || '')) {
      return json(401, { error: 'PIN temporario invalido.' });
    }

    const token = newToken();
    await supabase.from('beta_staff_sessions').insert({
      token_hash: tokenHash(token),
      operator_id: userId,
      user_agent: event.headers['user-agent'] || null,
    });
    await supabase.from('beta_security_events').insert({ event_key: `staff-login-ok:${userId}` });
    return json(200, { token, operatorId: userId });
  } catch (error) {
    return json(500, { error: error.message || 'Erro ao entrar na equipe.' });
  }
}
