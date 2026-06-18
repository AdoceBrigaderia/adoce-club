import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const json = (statusCode, body) => ({
  statusCode,
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
});

export function getAdmin() {
  if (!url || !serviceKey) throw new Error('Supabase backend nao configurado.');
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export function parseBody(event) {
  try {
    return event.body ? JSON.parse(event.body) : {};
  } catch {
    return {};
  }
}

export function phoneDigits(value = '') {
  return String(value).replace(/\D/g, '');
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 32, 'sha256').toString('hex');
  return { salt, hash };
}

export function verifyPassword(password, salt, expectedHash) {
  const { hash } = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'));
}

export function newToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export function authToken(event) {
  const header = event.headers.authorization || event.headers.Authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

export async function requireCustomer(event) {
  const token = authToken(event);
  if (!token) return { error: json(401, { error: 'Sessao ausente.' }) };
  const supabase = getAdmin();
  const { data: session, error } = await supabase
    .from('beta_customer_sessions')
    .select('customer_id, expires_at')
    .eq('token_hash', tokenHash(token))
    .gt('expires_at', new Date().toISOString())
    .single();
  if (error || !session) return { error: json(401, { error: 'Sessao expirada. Entre novamente.' }) };
  return { supabase, customerId: session.customer_id };
}

export async function loadCustomerBundle(supabase, customerId) {
  const [{ data: customer, error: customerError }, { data: card, error: cardError }, { data: events }] = await Promise.all([
    supabase.from('beta_customers').select('id,name,whatsapp,email,instagram,birth_date,accepts_promotions').eq('id', customerId).single(),
    supabase.from('beta_loyalty_cards').select('stamps,stamps_required').eq('customer_id', customerId).single(),
    supabase.from('beta_loyalty_events').select('event_type,stamps,note,created_at').eq('customer_id', customerId).order('created_at', { ascending: false }).limit(20),
  ]);
  if (customerError || cardError) throw new Error('Nao consegui carregar o cadastro.');
  return { customer, card, events: events || [] };
}
