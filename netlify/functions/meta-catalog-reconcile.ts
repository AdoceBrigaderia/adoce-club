import { scheduledMetaContext, syncCatalog } from "./_meta-catalog-service";

export default async () => {
  const context = scheduledMetaContext();
  if (!context) {
    console.info(JSON.stringify({ scope: "meta_catalog", operation: "reconciliation", status: "skipped", reason: "not_configured" }));
    return;
  }
  const result = await syncCatalog(context, "reconciliation");
  console.info(JSON.stringify({ scope: "meta_catalog", operation: "reconciliation", status: result.errors ? "error" : "synced", ...result }));
};

export const config = { schedule: "@daily" };
