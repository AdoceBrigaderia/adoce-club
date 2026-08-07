import { describe, expect, it, vi } from "vitest";
import {
  MetaCatalogClient,
  formatMetaPrice,
  isRetryableMetaStatus,
  prepareMetaItem,
  type CatalogProductRow,
} from "../netlify/functions/_meta-catalog";

const product = (overrides: Partial<CatalogProductRow> = {}): CatalogProductRow => ({
  id: "a7a7239d-6f35-4e4e-bcf8-16f077d0aabd",
  slug: "torta-morango",
  segment: "cakes",
  name: "Torta de morango",
  short_description: "Torta artesanal",
  description: "Torta artesanal feita pela Adoce.",
  base_price: 115,
  image_url: "https://example.com/torta.webp",
  published: true,
  active: true,
  exibir_whatsapp: true,
  meta_retailer_id: "torta-morango",
  meta_product_id: null,
  meta_sync_status: "pending",
  meta_payload_hash: null,
  meta_batch_handle: null,
  meta_sync_attempts: 0,
  meta_last_error_temporary: null,
  ...overrides,
});

describe("mapeamento do cat?logo Meta", () => {
  it("formata pre?o em BRL sem perder centavos", () => {
    expect(formatMetaPrice(20.9)).toBe("20.90 BRL");
  });

  it("cria payload completo com identificador permanente", async () => {
    const result = await prepareMetaItem(product(), "https://www.adocebrigaderia.com.br");
    expect(result?.method).toBe("CREATE");
    expect(result?.data).toMatchObject({
      id: "torta-morango",
      availability: "in stock",
      price: "115.00 BRL",
      image_link: "https://example.com/torta.webp",
    });
  });

  it("n?o envia produto novo que n?o est? marcado para WhatsApp", async () => {
    expect(await prepareMetaItem(product({ exibir_whatsapp: false }), "https://www.adocebrigaderia.com.br")).toBeNull();
  });

  it("mant?m item anterior e atualiza somente disponibilidade quando desativado", async () => {
    const result = await prepareMetaItem(product({ active: false, meta_payload_hash: "hash-anterior" }), "https://www.adocebrigaderia.com.br");
    expect(result).toMatchObject({ method: "UPDATE", operation: "availability", data: { availability: "out of stock" } });
  });

  it("rejeita produto sem pre?o ou sem imagem p?blica HTTPS", async () => {
    await expect(prepareMetaItem(product({ base_price: null }), "https://www.adocebrigaderia.com.br")).rejects.toThrow("pre?o");
    await expect(prepareMetaItem(product({ image_url: "http://localhost/foto.webp" }), "https://www.adocebrigaderia.com.br")).rejects.toThrow("imagem");
  });

  it("gera hash idempotente para os mesmos dados", async () => {
    const first = await prepareMetaItem(product(), "https://www.adocebrigaderia.com.br");
    const second = await prepareMetaItem(product(), "https://www.adocebrigaderia.com.br");
    expect(first?.payloadHash).toBe(second?.payloadHash);
  });
});

describe("cliente da Meta", () => {
  it.each([408, 429, 500, 503])("classifica HTTP %s como tempor?rio", (status) => {
    expect(isRetryableMetaStatus(status)).toBe(true);
  });

  it.each([400, 401, 403])("classifica HTTP %s como permanente", (status) => {
    expect(isRetryableMetaStatus(status)).toBe(false);
  });

  it("faz retry controlado em 429 e n?o exp?e o token", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "limite" } }), { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ handles: ["lote-1"] }), { status: 200 }));
    const client = new MetaCatalogClient("EA-token-secreto-que-nao-pode-vazar", "catalogo-1", "24.0", fetcher as typeof fetch);
    const prepared = await prepareMetaItem(product(), "https://www.adocebrigaderia.com.br");
    const result = await client.submitItem(prepared!);
    expect(result.handle).toBe("lote-1");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(result)).not.toContain("token-secreto");
  });

  it("n?o repete token inv?lido", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "Invalid OAuth access token" } }), { status: 401 }));
    const client = new MetaCatalogClient("token-invalido", "catalogo-1", "24.0", fetcher as typeof fetch);
    const prepared = await prepareMetaItem(product(), "https://www.adocebrigaderia.com.br");
    await expect(client.submitItem(prepared!)).rejects.toMatchObject({ status: 401, temporary: false });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
