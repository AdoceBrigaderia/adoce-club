import { authorizeMetaAdmin, json, metaStatus } from "./_meta-catalog-service";

export default async (request: Request) => {
  if (request.method !== "GET") return json({ error: "M?todo n?o permitido." }, 405);
  const context = await authorizeMetaAdmin(request, false);
  if (context instanceof Response) return context;
  try {
    return json(await metaStatus(context));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Falha ao consultar a integra??o." }, 500);
  }
};

export const config = { path: "/api/admin/integrations/meta/catalog/status" };
