import { authorizeMetaAdmin, json } from "./_meta-catalog-service";

export default async (request: Request) => {
  if (request.method !== "GET") return json({ error: "Método não permitido." }, 405);
  const context = await authorizeMetaAdmin(request, false);
  if (context instanceof Response) return context;
  const match = new URL(request.url).pathname.match(/\/products\/([0-9a-f-]{36})\/status$/i);
  if (!match) return json({ error: "Produto inválido." }, 400);
  const { data, error } = await context.admin.from("commercial_products")
    .select("id,meta_retailer_id,meta_product_id,exibir_whatsapp,meta_sync_status,meta_last_sync_at,meta_last_error,meta_sync_attempts,meta_batch_handle")
    .eq("id", match[1]).maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!data) return json({ error: "Produto não encontrado." }, 404);
  return json(data);
};

export const config = { path: "/api/admin/integrations/meta/catalog/products/:id/status" };
