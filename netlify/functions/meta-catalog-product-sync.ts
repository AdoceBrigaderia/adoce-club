import { authorizeMetaAdmin, json, syncProduct } from "./_meta-catalog-service";

export default async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const context = await authorizeMetaAdmin(request);
  if (context instanceof Response) return context;
  const match = new URL(request.url).pathname.match(/\/products\/([0-9a-f-]{36})\/sync$/i);
  if (!match) return json({ error: "Produto inválido." }, 400);
  try {
    return json(await syncProduct(context, match[1], "manual"));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Falha ao sincronizar o produto." }, 500);
  }
};

export const config = { path: "/api/admin/integrations/meta/catalog/products/:id/sync" };
