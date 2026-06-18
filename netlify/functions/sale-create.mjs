import crypto from 'node:crypto';
import { getAdmin, json, parseBody } from './_supabase-beta.mjs';

const revenuePayments = new Set(['Dinheiro', 'Pix', 'Cartão', 'Mercado Pago Point', 'Mercado Pago Link']);

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Metodo nao permitido.' });
  try {
    const body = parseBody(event);
    if (!body.qty || Number(body.qty) < 1) return json(400, { error: 'Quantidade invalida.' });
    const token = `ADOCE-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    const gross = revenuePayments.has(body.payment) ? Number(body.grossAmount || 0) : 0;
    const generates = revenuePayments.has(body.payment) && body.status === 'paid';
    const supabase = getAdmin();
    const { data, error } = await supabase.from('beta_sales').insert({
      token,
      operator_id: body.operatorId || null,
      operator_name: body.operatorName || null,
      qty: Number(body.qty),
      flavor: body.flavor || null,
      syrup: body.syrup || null,
      payment_method: body.payment,
      sale_kind: body.kind,
      status: body.status || 'paid',
      gross_amount: gross,
      generates_stamps: generates,
    }).select('id, token').single();
    if (error) throw error;
    return json(200, data);
  } catch (error) {
    return json(500, { error: error.message || 'Erro ao registrar venda.' });
  }
}
