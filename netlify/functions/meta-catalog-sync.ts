import { authorizeMetaAdmin, json, syncCatalog } from "./_meta-catalog-service";

export default async (request: Request) => {
  if (request.method !== "POST") return json({ error: "M?todo n?o permitido." }, 405);
  const context = await authorizeMetaAdmin(request);
  if (context instanceof Response) return context;
  try {
    return json(await syncCatalog(context, "manual"));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Falha ao sincronizar o cat?logo." }, 500);
  }
};

export const config = { path: "/api/admin/integrations/meta/catalog/sync" };
