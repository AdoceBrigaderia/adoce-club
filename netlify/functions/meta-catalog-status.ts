import { authorizeMetaAdmin, json, metaStatus } from "./_meta-catalog-service";

export default async (request: Request) => {
  if (request.method !== "GET") return json({ error: "Método não permitido." }, 405);
  const context = await authorizeMetaAdmin(request, false);
  if (context instanceof Response) return context;
  try {
    return json(await metaStatus(context));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Falha ao consultar a integração." }, 500);
  }
};

export const config = { path: "/api/admin/integrations/meta/catalog/status" };
