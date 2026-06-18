import { json, requireStaff } from './_supabase-beta.mjs';

export async function handler(event) {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Metodo nao permitido.' });
  try {
    const auth = await requireStaff(event);
    if (auth.error) return auth.error;

    const [{ data: customers, error: customersError }, { data: sales, error: salesError }] = await Promise.all([
      auth.supabase
        .from('beta_customers')
        .select('id,name,whatsapp,instagram,birth_date,invite_code,referred_by_code,created_at')
        .order('created_at', { ascending: false })
        .limit(300),
      auth.supabase
        .from('beta_sales')
        .select('claimed_by,flavor,created_at')
        .not('claimed_by', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1000),
    ]);
    if (customersError) throw customersError;
    if (salesError) throw salesError;

    const byCustomer = new Map();
    for (const sale of sales || []) {
      const row = byCustomer.get(sale.claimed_by) || { count: 0, flavors: new Map(), last: null };
      row.count += 1;
      if (!row.last) row.last = sale.created_at;
      if (sale.flavor) row.flavors.set(sale.flavor, (row.flavors.get(sale.flavor) || 0) + 1);
      byCustomer.set(sale.claimed_by, row);
    }

    const rows = (customers || []).map(customer => {
      const stats = byCustomer.get(customer.id);
      const favorite = stats ? [...stats.flavors.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] : '';
      return {
        ...customer,
        purchase_count: stats?.count || 0,
        favorite_flavor: favorite || 'Ainda sem preferência',
        last_purchase_at: stats?.last || null,
      };
    });

    return json(200, { total: rows.length, customers: rows });
  } catch (error) {
    return json(500, { error: error.message || 'Erro ao listar clientes.' });
  }
}
