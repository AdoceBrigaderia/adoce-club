import { authorizeMetaAdmin, json, syncCatalog } from "./_meta-catalog-service";

export default async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const context = await authorizeMetaAdmin(request);
  if (context instanceof Response) return context;
  try {
    return json(await syncCatalog(context, "manual", true));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Falha ao reprocessar produtos." }, 500);
  }
};

export const config = { path: "/api/admin/integrations/meta/catalog/retry-errors" };
