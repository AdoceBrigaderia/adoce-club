import crypto from 'node:crypto';
import { checkRateLimit, json, parseBody, requireStaff } from './_supabase-beta.mjs';

const revenuePayments = new Set(['Dinheiro', 'Pix', 'Cartão', 'Mercado Pago Point', 'Mercado Pago Link']);

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Metodo nao permitido.' });
  try {
    const body = parseBody(event);
    if (!body.qty || Number(body.qty) < 1) return json(400, { error: 'Quantidade invalida.' });
    const auth = await requireStaff(event);
    if (auth.error) return auth.error;
    const allowed = await checkRateLimit(auth.supabase, `sale-create:${auth.operatorId}`, 120, 60);
    if (!allowed) return json(429, { error: 'Limite de vendas atingido. Aguarde um pouco.' });
    const token = `ADOCE-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    const gross = revenuePayments.has(body.payment) ? Number(body.grossAmount || 0) : 0;
    const subtotal = revenuePayments.has(body.payment) ? Number(body.subtotalAmount ?? gross) : 0;
    const discountAmount = revenuePayments.has(body.payment) ? Number(body.discountAmount || 0) : 0;
    const generates = revenuePayments.has(body.payment) && body.status === 'paid';
    const { data, error } = await auth.supabase.from('beta_sales').insert({
      token,
      operator_id: auth.operatorId,
      operator_name: body.operatorName || null,
      qty: Number(body.qty),
      flavor: body.flavor || null,
      syrup: body.syrup || null,
      payment_method: body.payment,
      sale_kind: body.kind,
      status: body.status || 'paid',
      subtotal_amount: subtotal,
      discount_type: body.discountType || 'none',
      discount_value: Number(body.discountValue || 0),
      discount_reason: body.discountReason || null,
      discount_note: body.discountNote || null,
      discount_amount: discountAmount,
      gross_amount: gross,
      generates_stamps: generates,
    }).select('id, token').single();
    if (error) throw error;
    await auth.supabase.from('beta_security_events').insert({ event_key: `sale-create-ok:${auth.operatorId}` });
    return json(200, data);
  } catch (error) {
    return json(500, { error: error.message || 'Erro ao registrar venda.' });
  }
}
