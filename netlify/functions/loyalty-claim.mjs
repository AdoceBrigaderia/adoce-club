import { checkRateLimit, json, loadCustomerBundle, parseBody, requireCustomer } from './_supabase-beta.mjs';

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Metodo nao permitido.' });
  try {
    const auth = await requireCustomer(event);
    if (auth.error) return auth.error;
    const { token } = parseBody(event);
    if (!token) return json(400, { error: 'Token ausente.' });
    const allowed = await checkRateLimit(auth.supabase, `loyalty-claim:${auth.customerId}`, 30, 60);
    if (!allowed) return json(429, { error: 'Muitas tentativas de resgate. Aguarde alguns minutos.' });
    const { data: sale, error } = await auth.supabase
      .from('beta_sales')
      .select('id, qty, status, generates_stamps, claimed_at')
      .eq('token', token)
      .single();
    if (error || !sale) return json(404, { error: 'Este QR nao foi encontrado.' });
    if (sale.claimed_at) return json(409, { error: 'Este QR ja foi usado.' });
    if (sale.status !== 'paid' || !sale.generates_stamps) return json(400, { error: 'Esta venda ainda nao libera carimbos.' });

    const { data: card, error: cardError } = await auth.supabase
      .from('beta_loyalty_cards')
      .select('stamps, stamps_required')
      .eq('customer_id', auth.customerId)
      .single();
    if (cardError) throw cardError;

    const total = card.stamps + sale.qty;
    const nextStamps = total % card.stamps_required;
    const { data: claimedSale, error: claimError } = await auth.supabase
      .from('beta_sales')
      .update({ claimed_at: new Date().toISOString(), claimed_by: auth.customerId })
      .eq('id', sale.id)
      .is('claimed_at', null)
      .select('id')
      .single();
    if (claimError || !claimedSale) return json(409, { error: 'Este QR ja foi usado.' });
    await auth.supabase.from('beta_loyalty_cards').update({ stamps: nextStamps, updated_at: new Date().toISOString() }).eq('customer_id', auth.customerId);
    await auth.supabase.from('beta_loyalty_events').insert({
      customer_id: auth.customerId,
      sale_id: sale.id,
      event_type: 'purchase',
      stamps: sale.qty,
      note: total >= card.stamps_required ? 'Compra com premio gerado' : 'Compra registrada',
    });
    if (total >= card.stamps_required) {
      await auth.supabase.from('beta_loyalty_events').insert({
        customer_id: auth.customerId,
        sale_id: sale.id,
        event_type: 'redeem',
        stamps: -card.stamps_required,
        note: 'Cartela completa: 1 fatia gratis pendente',
      });
    }
    return json(200, await loadCustomerBundle(auth.supabase, auth.customerId));
  } catch (error) {
    return json(500, { error: error.message || 'Erro ao resgatar carimbos.' });
  }
}
