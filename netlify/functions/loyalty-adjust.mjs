import { checkRateLimit, json, parseBody, phoneDigits, requireStaff } from './_supabase-beta.mjs';

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Metodo nao permitido.' });
  try {
    const auth = await requireStaff(event);
    if (auth.error) return auth.error;
    const body = parseBody(event);
    const digits = phoneDigits(body.whatsapp);
    const stamps = Number(body.stamps || 0);
    const mode = body.mode === 'set' ? 'set' : 'add';
    const reason = String(body.reason || '').trim();
    if (digits.length < 10) return json(400, { error: 'Informe o WhatsApp do cliente.' });
    if (!Number.isInteger(stamps) || stamps < 0 || stamps > 100) return json(400, { error: 'Informe uma quantidade valida de carimbos.' });
    if (reason.length < 5) return json(400, { error: 'Informe o motivo do ajuste.' });
    const allowed = await checkRateLimit(auth.supabase, `loyalty-adjust:${auth.operatorId}`, 40, 60);
    if (!allowed) return json(429, { error: 'Limite de ajustes atingido. Aguarde um pouco.' });

    const { data: customer, error: customerError } = await auth.supabase
      .from('beta_customers')
      .select('id,name,whatsapp')
      .eq('whatsapp_digits', digits)
      .single();
    if (customerError || !customer) return json(404, { error: 'Cliente nao encontrado pelo WhatsApp.' });

    const { data: card, error: cardError } = await auth.supabase
      .from('beta_loyalty_cards')
      .select('stamps,stamps_required')
      .eq('customer_id', customer.id)
      .single();
    if (cardError) throw cardError;

    const nextStamps = mode === 'set' ? stamps % card.stamps_required : (card.stamps + stamps) % card.stamps_required;
    await auth.supabase
      .from('beta_loyalty_cards')
      .update({ stamps: nextStamps, updated_at: new Date().toISOString() })
      .eq('customer_id', customer.id);
    await auth.supabase.from('beta_loyalty_events').insert({
      customer_id: customer.id,
      event_type: 'adjustment',
      stamps: mode === 'set' ? nextStamps - card.stamps : stamps,
      note: `Ajuste manual por ${auth.operatorId}: ${reason}`,
    });
    await auth.supabase.from('beta_security_events').insert({ event_key: `loyalty-adjust-ok:${auth.operatorId}:${customer.id}` });

    return json(200, { customer, card: { stamps: nextStamps, stamps_required: card.stamps_required } });
  } catch (error) {
    return json(500, { error: error.message || 'Erro ao ajustar carimbos.' });
  }
}
