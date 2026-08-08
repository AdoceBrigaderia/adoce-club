export type MetaSyncOrigin = "manual" | "automatic" | "reconciliation";
export type MetaSyncOperation = "create" | "update" | "availability";

export type CatalogProductRow = {
  id: string;
  slug: string;
  segment: "cakes" | "sweets" | "events" | "school" | "rentals";
  name: string;
  short_description: string;
  description: string;
  base_price: number | null;
  image_url: string | null;
  published: boolean;
  active: boolean;
  exibir_whatsapp: boolean;
  meta_retailer_id: string;
  meta_product_id: string | null;
  meta_sync_status: string;
  meta_payload_hash: string | null;
  meta_batch_handle: string | null;
  meta_sync_attempts: number;
  meta_last_error_temporary: boolean | null;
};

export type MetaProductData = {
  id: string;
  title?: string;
  description?: string;
  availability: "in stock" | "out of stock";
  condition?: "new";
  price?: string;
  link?: string;
  image_link?: string;
  brand?: string;
  product_type?: string;
};

export type PreparedMetaItem = {
  operation: MetaSyncOperation;
  method: "CREATE" | "UPDATE";
  data: MetaProductData;
  payloadHash: string;
};

export class MetaCatalogError extends Error {
  status: number;
  temporary: boolean;
  responseSummary: string;

  constructor(message: string, status = 500, responseSummary = "") {
    super(message);
    this.name = "MetaCatalogError";
    this.status = status;
    this.temporary = status === 408 || status === 429 || status >= 500;
    this.responseSummary = responseSummary;
  }
}

const segmentNames: Record<CatalogProductRow["segment"], string> = {
  cakes: "Tortas",
  sweets: "Docinhos",
  events: "Eventos",
  school: "Adoce na Escola",
  rentals: "Aluguel de decora??o",
};

const stableJson = (value: unknown) => JSON.stringify(value, Object.keys(value as object).sort());

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function formatMetaPrice(value: number) {
  if (!Number.isFinite(value) || value <= 0) throw new Error("O produto precisa ter pre?o maior que zero para a Meta.");
  return `${value.toFixed(2)} BRL`;
}

export function isPublicHttpsUrl(value: string | null | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !["localhost", "127.0.0.1"].includes(url.hostname);
  } catch {
    return false;
  }
}

export async function prepareMetaItem(product: CatalogProductRow, productBaseUrl: string): Promise<PreparedMetaItem | null> {
  const previouslySubmitted = Boolean(product.meta_payload_hash || product.meta_product_id || product.meta_batch_handle);
  const available = product.exibir_whatsapp && product.active && product.published;

  if (!available && !previouslySubmitted) return null;

  if (!available) {
    const data: MetaProductData = { id: product.meta_retailer_id, availability: "out of stock" };
    return {
      operation: "availability",
      method: "UPDATE",
      data,
      payloadHash: await sha256(stableJson(data)),
    };
  }

  if (product.base_price === null) throw new Error("Defina o pre?o antes de exibir este produto no WhatsApp.");
  if (!isPublicHttpsUrl(product.image_url)) throw new Error("Defina uma imagem principal com URL p?blica HTTPS.");
  if (!isPublicHttpsUrl(productBaseUrl)) throw new Error("Configure uma URL p?blica HTTPS para os produtos.");

  const data: MetaProductData = {
    id: product.meta_retailer_id,
    title: product.name.trim().slice(0, 150),
    description: (product.description.trim() || product.short_description.trim() || product.name.trim()).slice(0, 5000),
    availability: "in stock",
    condition: "new",
    price: formatMetaPrice(product.base_price),
    link: `${productBaseUrl.replace(/\/$/, "")}/?produto=${encodeURIComponent(product.slug)}`,
    image_link: product.image_url!,
    brand: "Adoce Brigaderia",
    product_type: segmentNames[product.segment],
  };
  return {
    operation: previouslySubmitted ? "update" : "create",
    method: previouslySubmitted ? "UPDATE" : "CREATE",
    data,
    payloadHash: await sha256(stableJson(data)),
  };
}

export function isRetryableMetaStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

const safeSummary = (value: unknown) => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.replace(/EA[A-Za-z0-9_-]{20,}/g, "[token removido]").slice(0, 1200);
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class MetaCatalogClient {
  private readonly baseUrl: string;

  constructor(
    private readonly accessToken: string,
    private readonly catalogId: string,
    apiVersion: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    const version = apiVersion.replace(/^v/, "");
    if (!/^\d+\.\d+$/.test(version)) throw new Error("META_GRAPH_API_VERSION inv?lida.");
    this.baseUrl = `https://graph.facebook.com/v${version}`;
  }

  private async request(path: string, init: RequestInit, maxAttempts = 3) {
    let lastError: MetaCatalogError | null = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await this.fetcher(`${this.baseUrl}/${path}`, {
          ...init,
          signal: AbortSignal.timeout(8_000),
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
            ...(init.headers || {}),
          },
        });
        const payload = await response.json().catch(() => ({}));
        if (response.ok) return { payload, status: response.status, attempt };
        const message = (payload as { error?: { message?: string } }).error?.message || `Meta respondeu HTTP ${response.status}.`;
        lastError = new MetaCatalogError(message, response.status, safeSummary(payload));
      } catch (error) {
        lastError = new MetaCatalogError(error instanceof Error ? error.message : "Falha de rede ao acessar a Meta.", 408);
      }
      if (!lastError.temporary || attempt === maxAttempts) throw lastError;
      await sleep(attempt === 1 ? 250 : 750);
    }
    throw lastError || new MetaCatalogError("Falha desconhecida na integra??o com a Meta.");
  }

  async validateConnection() {
    return this.request(`${encodeURIComponent(this.catalogId)}?fields=id,name,vertical`, { method: "GET" }, 1);
  }

  async submitItem(item: PreparedMetaItem) {
    const result = await this.request(`${encodeURIComponent(this.catalogId)}/items_batch`, {
      method: "POST",
      body: JSON.stringify({
        item_type: "PRODUCT_ITEM",
        requests: [{ method: item.method, data: item.data }],
      }),
    });
    const handles = (result.payload as { handles?: string[] }).handles || [];
    if (!handles[0]) throw new MetaCatalogError("A Meta aceitou a chamada, mas n?o devolveu o identificador do lote.", 502, safeSummary(result.payload));
    return { ...result, handle: handles[0], summary: safeSummary(result.payload) };
  }

  async checkBatch(handle: string) {
    const result = await this.request(
      `${encodeURIComponent(this.catalogId)}/check_batch_request_status?handle=${encodeURIComponent(handle)}`,
      { method: "GET" },
      2,
    );
    return { ...result, summary: safeSummary(result.payload) };
  }
}
