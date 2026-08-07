import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  MetaCatalogClient,
  MetaCatalogError,
  prepareMetaItem,
  type CatalogProductRow,
  type MetaSyncOrigin,
} from "./_meta-catalog";
import { ACCESS_COOKIE, SURFACE_COOKIE, parseCookies, validCsrf } from "./_shared/session-security";

declare const Netlify: { env: { get(name: string): string | undefined } } | undefined;

export const env = (name: string) =>
  (typeof Netlify !== "undefined" ? Netlify.env.get(name) : undefined) || process.env[name];

export const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

const allowedOrigin = (request: Request) => {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const configured = env("SITE_URL")?.replace(/\/$/, "");
  return new Set([
    configured,
    "https://www.adocebrigaderia.com.br",
    "https://clube.adocebrigaderia.com.br",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ].filter(Boolean)).has(origin);
};

export type MetaServiceContext = {
  admin: SupabaseClient;
  actorId: string | null;
  client: MetaCatalogClient | null;
  configured: boolean;
  productBaseUrl: string;
  catalogId: string;
};

const serverConfiguration = () => {
  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL") || "";
  const publishableKey = env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY") || "";
  const secretKey = env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY") || "";
  const accessToken = env("META_ACCESS_TOKEN") || "";
  const catalogId = env("META_CATALOG_ID") || "";
  const apiVersion = env("META_GRAPH_API_VERSION") || "24.0";
  const productBaseUrl = env("META_CATALOG_PRODUCT_BASE_URL") || env("SITE_URL") || "";
  return { supabaseUrl, publishableKey, secretKey, accessToken, catalogId, apiVersion, productBaseUrl };
};

export async function authorizeMetaAdmin(request: Request, requireMetaConfiguration = true): Promise<MetaServiceContext | Response> {
  if (!allowedOrigin(request)) return json({ error: "Origem n?o autorizada." }, 403);
  if (request.method !== "GET" && !validCsrf(request)) return json({ error: "Valida??o CSRF inv?lida." }, 403);
  const cookies = parseCookies(request);
  if (cookies.get(SURFACE_COOKIE) !== "operation") return json({ error: "Sess?o operacional obrigat?ria." }, 403);
  const accessToken = cookies.get(ACCESS_COOKIE) || "";
  if (!accessToken) return json({ error: "Sess?o obrigat?ria." }, 401);

  const config = serverConfiguration();
  if (!config.supabaseUrl || !config.publishableKey || !config.secretKey)
    return json({ error: "A??o administrativa n?o configurada." }, 503);

  const sessionClient = createClient(config.supabaseUrl, config.publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await sessionClient.auth.getUser(accessToken);
  if (userError || !userData.user) return json({ error: "Sess?o inv?lida ou expirada." }, 401);
  const { data: staff } = await sessionClient.from("staff_members").select("role,active").eq("user_id", userData.user.id).maybeSingle();
  if (!staff?.active || !["owner", "manager"].includes(staff.role))
    return json({ error: "Somente propriet?rios e gerentes podem sincronizar o cat?logo." }, 403);

  const metaConfigured = Boolean(config.accessToken && config.catalogId && config.productBaseUrl);
  if (requireMetaConfiguration && !metaConfigured)
    return json({ error: "Integra??o com a Meta aguardando configura??o no servidor.", code: "META_NOT_CONFIGURED" }, 503);

  const admin = createClient(config.supabaseUrl, config.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return {
    admin,
    actorId: userData.user.id,
    client: metaConfigured ? new MetaCatalogClient(config.accessToken, config.catalogId, config.apiVersion) : null,
    configured: metaConfigured,
    productBaseUrl: config.productBaseUrl,
    catalogId: config.catalogId,
  };
}

export function scheduledMetaContext(): MetaServiceContext | null {
  const config = serverConfiguration();
  if (!config.supabaseUrl || !config.secretKey || !config.accessToken || !config.catalogId || !config.productBaseUrl) return null;
  return {
    admin: createClient(config.supabaseUrl, config.secretKey, { auth: { persistSession: false, autoRefreshToken: false } }),
    actorId: null,
    client: new MetaCatalogClient(config.accessToken, config.catalogId, config.apiVersion),
    configured: true,
    productBaseUrl: config.productBaseUrl,
    catalogId: config.catalogId,
  };
}

const productFields = "id,slug,segment,name,short_description,description,base_price,image_url,published,active,exibir_whatsapp,meta_retailer_id,meta_product_id,meta_sync_status,meta_payload_hash,meta_batch_handle,meta_sync_attempts,meta_last_error_temporary";

const logEvent = (event: Record<string, unknown>) =>
  console.info(JSON.stringify({ scope: "meta_catalog", ...event }));

async function history(
  context: MetaServiceContext,
  values: Record<string, unknown>,
) {
  const { error } = await context.admin.from("meta_catalog_sync_history").insert(values);
  if (error) logEvent({ level: "error", operation: "history", status: "error", message: error.message });
}

function batchState(payload: unknown) {
  const root = payload as { data?: unknown[]; status?: string; errors?: unknown[]; error?: unknown };
  const first = (Array.isArray(root?.data) ? root.data[0] : root) as { status?: string; errors?: unknown[]; error?: unknown } | undefined;
  const status = String(first?.status || root?.status || "").toLowerCase();
  const errors = first?.errors || root?.errors || (first?.error ? [first.error] : root?.error ? [root.error] : []);
  return {
    finished: ["finished", "complete", "completed", "success", "succeeded"].includes(status),
    failed: ["failed", "error"].includes(status) || (Array.isArray(errors) && errors.length > 0),
    summary: JSON.stringify({ status: status || "processing", errors }).slice(0, 1200),
  };
}

export async function pollSubmittedProduct(context: MetaServiceContext, product: CatalogProductRow, origin: MetaSyncOrigin) {
  if (!product.meta_batch_handle) return { productId: product.id, status: "pending" };
  const started = Date.now();
  try {
    const result = await context.client!.checkBatch(product.meta_batch_handle);
    const state = batchState(result.payload);
    if (!state.finished && !state.failed) return { productId: product.id, status: "submitted" };
    if (state.failed) throw new MetaCatalogError("A Meta rejeitou um ou mais campos do produto.", 400, state.summary);
    await context.admin.from("commercial_products").update({
      meta_sync_status: product.exibir_whatsapp ? "synced" : "disabled",
      meta_last_sync_at: new Date().toISOString(),
      meta_last_error: null,
      meta_last_error_temporary: null,
      meta_batch_handle: null,
    }).eq("id", product.id);
    await history(context, {
      product_id: product.id,
      retailer_id: product.meta_retailer_id,
      operation: "batch_status",
      origin,
      status: "synced",
      http_status: result.status,
      response_summary: state.summary,
      attempt: Math.max(1, product.meta_sync_attempts),
      payload_hash: product.meta_payload_hash,
      duration_ms: Date.now() - started,
      batch_handle: product.meta_batch_handle,
    });
    return { productId: product.id, status: "synced" };
  } catch (error) {
    const metaError = error instanceof MetaCatalogError ? error : new MetaCatalogError(error instanceof Error ? error.message : "Falha ao consultar lote.");
    await context.admin.from("commercial_products").update({
      meta_sync_status: "error",
      meta_last_error: metaError.message.slice(0, 1000),
      meta_last_error_temporary: metaError.temporary,
      meta_batch_handle: null,
    }).eq("id", product.id);
    await history(context, {
      product_id: product.id,
      retailer_id: product.meta_retailer_id,
      operation: "batch_status",
      origin,
      status: "error",
      http_status: metaError.status,
      response_summary: metaError.responseSummary,
      error_message: metaError.message.slice(0, 1000),
      attempt: Math.max(1, product.meta_sync_attempts),
      payload_hash: product.meta_payload_hash,
      duration_ms: Date.now() - started,
      batch_handle: product.meta_batch_handle,
    });
    return { productId: product.id, status: "error", error: metaError.message };
  }
}

export async function syncProduct(context: MetaServiceContext, productId: string, origin: MetaSyncOrigin) {
  const { data, error } = await context.admin.from("commercial_products").select(productFields).eq("id", productId).maybeSingle();
  if (error || !data) throw new Error("Produto n?o encontrado.");
  const product = data as CatalogProductRow;
  if (product.meta_sync_status === "submitted" && product.meta_batch_handle)
    return pollSubmittedProduct(context, product, origin);

  const started = Date.now();
  const correlationId = crypto.randomUUID();
  try {
    const prepared = await prepareMetaItem(product, context.productBaseUrl);
    if (!prepared) {
      await context.admin.from("commercial_products").update({ meta_sync_status: "disabled", meta_last_error: null }).eq("id", product.id);
      await history(context, {
        product_id: product.id, retailer_id: product.meta_retailer_id, operation: "validate", origin,
        status: "skipped", response_summary: "Produto n?o marcado para o WhatsApp e nunca enviado.", attempt: 1,
        correlation_id: correlationId, duration_ms: Date.now() - started,
      });
      return { productId: product.id, status: "skipped" };
    }
    if (product.meta_sync_status === "synced" && product.meta_payload_hash === prepared.payloadHash)
      return { productId: product.id, status: "skipped", reason: "unchanged" };

    const nextAttempt = Math.min(20, Math.max(0, product.meta_sync_attempts) + 1);
    await context.admin.from("commercial_products").update({
      meta_sync_status: "syncing", meta_last_error: null, meta_sync_attempts: nextAttempt,
      meta_last_error_temporary: null,
    }).eq("id", product.id);
    const result = await context.client!.submitItem(prepared);
    await context.admin.from("commercial_products").update({
      meta_sync_status: "submitted",
      meta_product_id: product.meta_product_id || product.meta_retailer_id,
      meta_payload_hash: prepared.payloadHash,
      meta_batch_handle: result.handle,
      meta_last_error: null,
      meta_last_error_temporary: null,
    }).eq("id", product.id);
    await history(context, {
      product_id: product.id, retailer_id: product.meta_retailer_id, operation: prepared.operation, origin,
      status: "submitted", http_status: result.status, response_summary: result.summary, attempt: result.attempt,
      correlation_id: correlationId, payload_hash: prepared.payloadHash, duration_ms: Date.now() - started,
      batch_handle: result.handle,
    });
    logEvent({ product: product.id, retailer_id: product.meta_retailer_id, operation: prepared.operation, catalog: context.catalogId, attempt: result.attempt, duration_ms: Date.now() - started, status: "submitted", http_status: result.status, correlation_id: correlationId });
    return { productId: product.id, status: "submitted", handle: result.handle };
  } catch (error) {
    const metaError = error instanceof MetaCatalogError ? error : new MetaCatalogError(error instanceof Error ? error.message : "Falha ao preparar produto.", 400);
    await context.admin.from("commercial_products").update({
      meta_sync_status: "error", meta_last_error: metaError.message.slice(0, 1000), meta_last_error_temporary: metaError.temporary, meta_batch_handle: null,
    }).eq("id", product.id);
    await history(context, {
      product_id: product.id, retailer_id: product.meta_retailer_id, operation: "validate", origin,
      status: "error", http_status: metaError.status, response_summary: metaError.responseSummary,
      error_message: metaError.message.slice(0, 1000), attempt: Math.min(20, Math.max(1, product.meta_sync_attempts + 1)),
      correlation_id: correlationId, duration_ms: Date.now() - started,
    });
    logEvent({ level: "error", product: product.id, retailer_id: product.meta_retailer_id, operation: "sync", catalog: context.catalogId, duration_ms: Date.now() - started, status: "error", http_status: metaError.status, correlation_id: correlationId, temporary: metaError.temporary, message: metaError.message });
    return { productId: product.id, status: "error", error: metaError.message };
  }
}

export async function syncCatalog(context: MetaServiceContext, origin: MetaSyncOrigin, onlyErrors = false) {
  let query = context.admin.from("commercial_products").select(productFields).order("updated_at", { ascending: true }).limit(250);
  if (onlyErrors) query = query.eq("meta_sync_status", "error");
  else query = query.or("exibir_whatsapp.eq.true,meta_sync_status.in.(pending,error,submitted),meta_payload_hash.not.is.null");
  const { data, error } = await query;
  if (error) throw error;
  const started = Date.now();
  const candidates = ((data || []) as CatalogProductRow[]).filter((product) =>
    origin !== "reconciliation"
      || product.meta_sync_status !== "error"
      || (product.meta_last_error_temporary === true && product.meta_sync_attempts < 5),
  );
  const results = [];
  for (const product of candidates) results.push(await syncProduct(context, product.id, origin));
  const summary = {
    total: results.length,
    submitted: results.filter((item) => item.status === "submitted").length,
    synced: results.filter((item) => item.status === "synced").length,
    skipped: results.filter((item) => item.status === "skipped").length,
    errors: results.filter((item) => item.status === "error").length,
  };
  await history(context, {
    operation: "full_sync", origin, status: summary.errors ? "error" : summary.submitted ? "submitted" : "synced",
    response_summary: JSON.stringify(summary), error_message: summary.errors ? `${summary.errors} produto(s) com erro.` : null,
    attempt: 1, duration_ms: Date.now() - started,
  });
  return { ...summary, results };
}

export async function metaStatus(context: MetaServiceContext) {
  const [{ data: products, error }, { data: lastRun }] = await Promise.all([
    context.admin.from("commercial_products").select("meta_sync_status,exibir_whatsapp"),
    context.admin.from("meta_catalog_sync_history").select("created_at,status,response_summary").eq("operation", "full_sync").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (error) throw error;
  let connection: { connected: boolean; name?: string; error?: string } = { connected: false };
  if (context.client) {
    try {
      const result = await context.client.validateConnection();
      const payload = result.payload as { name?: string };
      connection = { connected: true, name: payload.name };
    } catch (validationError) {
      connection = { connected: false, error: validationError instanceof Error ? validationError.message : "N?o foi poss?vel validar a conex?o." };
    }
  } else {
    connection = { connected: false, error: "Credenciais da Meta ainda n?o configuradas no servidor." };
  }
  const rows = products || [];
  return {
    configured: context.configured,
    connection,
    counts: {
      enabled: rows.filter((item) => item.exibir_whatsapp).length,
      synced: rows.filter((item) => item.meta_sync_status === "synced").length,
      submitted: rows.filter((item) => item.meta_sync_status === "submitted").length,
      pending: rows.filter((item) => item.meta_sync_status === "pending").length,
      errors: rows.filter((item) => item.meta_sync_status === "error").length,
    },
    lastFullSync: lastRun || null,
  };
}

export async function metaHistory(context: MetaServiceContext, request: Request) {
  const url = new URL(request.url);
  let query = context.admin.from("meta_catalog_sync_history")
    .select("id,product_id,retailer_id,operation,origin,status,http_status,response_summary,error_message,attempt,correlation_id,duration_ms,created_at")
    .order("created_at", { ascending: false }).limit(Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 50)));
  const status = url.searchParams.get("status");
  const productId = url.searchParams.get("product_id");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (status) query = query.eq("status", status);
  if (productId) query = query.eq("product_id", productId);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
