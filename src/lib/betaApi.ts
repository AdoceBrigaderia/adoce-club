import type { CustomerProfile, Product, Reward, Sale } from '../store';

const TOKEN_KEY = 'adoce_beta_token';
const STAFF_TOKEN_KEY = 'adoce_staff_token';

type Bundle = {
  token?: string;
  customer: {
    id: string;
    name: string;
    whatsapp: string;
    email?: string | null;
    instagram?: string | null;
    birth_date?: string | null;
    accepts_promotions?: boolean;
    invite_code?: string | null;
    referred_by_code?: string | null;
  };
  card: { stamps: number; stamps_required: number };
  events?: { event_type: string; stamps: number; note?: string; created_at: string }[];
};

function token() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

function staffToken() {
  return localStorage.getItem(STAFF_TOKEN_KEY) || '';
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json');
  const currentToken = token();
  if (currentToken && !headers.has('authorization')) headers.set('authorization', `Bearer ${currentToken}`);
  const response = await fetch(`/.netlify/functions/${path}`, { ...init, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Nao foi possivel concluir a operacao.');
  return data as T;
}

export function saveToken(value?: string) {
  if (value) localStorage.setItem(TOKEN_KEY, value);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function saveStaffToken(value?: string) {
  if (value) localStorage.setItem(STAFF_TOKEN_KEY, value);
}

export function clearStaffToken() {
  localStorage.removeItem(STAFF_TOKEN_KEY);
}

export function hasToken() {
  return Boolean(token());
}

export function bundleToState(bundle: Bundle) {
  if (bundle.token) saveToken(bundle.token);
  const customer: CustomerProfile = {
    name: bundle.customer.name,
    whatsapp: bundle.customer.whatsapp,
    email: bundle.customer.email || '',
    instagram: bundle.customer.instagram || '',
    birthDate: bundle.customer.birth_date || '',
    password: '',
    registered: true,
    lgpdAccepted: true,
    betaAccepted: true,
    acceptsPromotions: bundle.customer.accepts_promotions !== false,
    inviteCode: bundle.customer.referred_by_code || '',
  };
  const rewards: Reward[] = (bundle.events || [])
    .filter(event => event.event_type === 'redeem')
    .map((event, index) => ({
      id: `${event.created_at}-${index}`,
      customer: customer.name,
      type: '1 fatia grátis',
      origin: event.note || 'cartela completa',
      status: 'pendente',
      generatedAt: new Date(event.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
    }));
  return { customer, stamps: bundle.card.stamps, stampGoal: bundle.card.stamps_required, events: bundle.events || [], rewards };
}

export type CustomerAdminRow = {
  id: string;
  name: string;
  whatsapp: string;
  instagram?: string | null;
  birth_date?: string | null;
  invite_code?: string | null;
  referred_by_code?: string | null;
  purchase_count: number;
  favorite_flavor: string;
  last_purchase_at?: string | null;
};

export async function listCustomers() {
  const headers = staffToken() ? { authorization: `Bearer ${staffToken()}` } : undefined;
  return api<{ total: number; customers: CustomerAdminRow[] }>('customers-list', { headers });
}

export async function listProductsCloud() {
  const headers = staffToken() ? { authorization: `Bearer ${staffToken()}` } : undefined;
  return api<{ products: {
    id: string;
    name: string;
    short_name: string;
    image_url?: string | null;
    active: boolean;
    created_at: string;
    updated_at: string;
  }[] }>('products-list', { headers });
}

export async function saveProductCloud(product: Product) {
  const headers = staffToken() ? { authorization: `Bearer ${staffToken()}` } : undefined;
  return api<{ product: {
    id: string;
    name: string;
    short_name: string;
    image_url?: string | null;
    active: boolean;
    created_at: string;
    updated_at: string;
  } }>('products-save', {
    method: 'POST',
    headers,
    body: JSON.stringify({ product }),
  });
}

export async function registerBetaCustomer(form: CustomerProfile) {
  return bundleToState(await api<Bundle>('customer-register', { method: 'POST', body: JSON.stringify(form) }));
}

export async function loginBetaCustomer(whatsapp: string, password: string) {
  return bundleToState(await api<Bundle>('customer-login', { method: 'POST', body: JSON.stringify({ whatsapp, password }) }));
}

export async function loginStaffBeta(userId: string, pin: string) {
  const response = await api<{ token: string; operatorId: string }>('staff-login', { method: 'POST', body: JSON.stringify({ userId, pin }) });
  saveStaffToken(response.token);
  return response;
}

export async function loadBetaCustomer() {
  return bundleToState(await api<Bundle>('customer-me'));
}

export async function updateBetaCustomer(form: CustomerProfile) {
  return bundleToState(await api<Bundle>('customer-update', { method: 'POST', body: JSON.stringify(form) }));
}

export async function createCloudSale(sale: Sale) {
  const headers = staffToken() ? { authorization: `Bearer ${staffToken()}` } : undefined;
  return api<{ id: string; token: string }>('sale-create', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      qty: sale.qty,
      payment: sale.payment,
      kind: sale.kind,
      status: sale.status,
      subtotalAmount: sale.subtotalAmount,
      discountType: sale.discountType,
      discountValue: sale.discountValue,
      discountReason: sale.discountReason,
      discountNote: sale.discountNote,
      discountAmount: sale.discountAmount,
      grossAmount: sale.grossAmount,
      items: sale.items,
      flavor: sale.flavor,
      syrup: sale.syrup,
      operatorId: sale.operatorId,
      operatorName: sale.seller,
    }),
  });
}

export async function claimCloudSale(tokenValue: string) {
  return bundleToState(await api<Bundle>('loyalty-claim', { method: 'POST', body: JSON.stringify({ token: tokenValue }) }));
}

export async function adjustCustomerStamps(data: { whatsapp: string; stamps: number; mode: 'add' | 'set'; reason: string; operatorId: string }) {
  const headers = staffToken() ? { authorization: `Bearer ${staffToken()}` } : undefined;
  return api<{ customer: { name: string; whatsapp: string }; card: { stamps: number; stamps_required: number } }>('loyalty-adjust', {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
}
